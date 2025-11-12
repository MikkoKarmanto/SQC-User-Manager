import { useCallback, useEffect, useState } from "react";
import { listAuthProviders, listUsersForProvider } from "../services/safeqClient";
import { extractUsers, type SafeQAuthProvider, type SafeQUser } from "../types/safeq";
import UserTable from "../components/UserTable";
import EditUserModal from "../components/EditUserModal";
import Tabs, { type Tab } from "../components/Tabs";

interface ProviderData {
  provider: SafeQAuthProvider;
  users: SafeQUser[];
  isLoading: boolean;
  error: string | null;
}

function UsersPage() {
  const [providers, setProviders] = useState<SafeQAuthProvider[]>([]);
  const [providerData, setProviderData] = useState<Map<number, ProviderData>>(new Map());
  const [activeProviderId, setActiveProviderId] = useState<number | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<SafeQUser | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const fetchProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    setProvidersError(null);

    try {
      const response = await listAuthProviders();
      const providersList = Array.isArray(response) ? (response as SafeQAuthProvider[]) : [];
      setProviders(providersList);
      setLastFetchedAt(new Date());

      // Set first provider as active
      if (providersList.length > 0 && !activeProviderId) {
        setActiveProviderId(providersList[0].id);
      }
    } catch (err) {
      setProvidersError(toErrorMessage(err));
      setProviders([]);
    } finally {
      setIsLoadingProviders(false);
    }
  }, [activeProviderId]);

  const fetchUsersForProvider = useCallback(
    async (providerId: number) => {
      setProviderData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(providerId);
        if (existing) {
          newMap.set(providerId, { ...existing, isLoading: true, error: null });
        }
        return newMap;
      });

      try {
        const response = await listUsersForProvider(providerId);
        const usersList = extractUsers(response);

        setProviderData((prev) => {
          const newMap = new Map(prev);
          const provider = providers.find((p) => p.id === providerId);
          if (provider) {
            newMap.set(providerId, {
              provider,
              users: usersList,
              isLoading: false,
              error: null,
            });
          }
          return newMap;
        });

        // Return the users list for use in handleRefresh
        return usersList;
      } catch (err) {
        setProviderData((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(providerId);
          if (existing) {
            newMap.set(providerId, {
              ...existing,
              isLoading: false,
              error: toErrorMessage(err),
            });
          }
          return newMap;
        });
        return null;
      }
    },
    [providers]
  );

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (activeProviderId && !providerData.has(activeProviderId)) {
      fetchUsersForProvider(activeProviderId);
    }
  }, [activeProviderId, providerData, fetchUsersForProvider]);

  const handleTabChange = (tabId: string) => {
    const providerId = parseInt(tabId, 10);
    setActiveProviderId(providerId);
    // Clear selection when switching tabs
    setSelectedUserIds(new Set());
  };

  const handleRefresh = async () => {
    if (activeProviderId) {
      const updatedUsers = await fetchUsersForProvider(activeProviderId);

      // Update the selectedUser with fresh data if modal is open
      if (selectedUser && updatedUsers) {
        const updatedUser = updatedUsers.find((u) => u.id === selectedUser.id);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      }
    }
  };

  const handleRefreshAll = () => {
    fetchProviders();
    setProviderData(new Map());
  };

  const tabs: Tab[] = providers.map((provider) => ({
    id: provider.id.toString(),
    label: provider.name || `Provider ${provider.id}`,
    badge: providerData.get(provider.id)?.users.length,
  }));

  const activeData = activeProviderId ? providerData.get(activeProviderId) : null;

  return (
    <section className="page">
      <header className="page-header">
        <h2>Users</h2>
        <p>Manage SafeQ Cloud users from your tenant. View user details, groups, and properties.</p>
      </header>

      <div className="card">
        <div className="card-actions">
          <button type="button" onClick={handleRefresh} disabled={activeData?.isLoading || isLoadingProviders}>
            {activeData?.isLoading ? "Loading..." : "Refresh Current"}
          </button>
          <button type="button" onClick={handleRefreshAll} disabled={isLoadingProviders}>
            {isLoadingProviders ? "Loading..." : "Refresh All"}
          </button>
          {lastFetchedAt && <span className="timestamp">Providers loaded {lastFetchedAt.toLocaleString()}</span>}
          {activeData && activeData.users.length > 0 && !activeData.isLoading && <span className="timestamp">{activeData.users.length} users</span>}
        </div>

        {providersError ? <div className="status error">{providersError}</div> : null}

        {!providersError && !isLoadingProviders && providers.length === 0 && (
          <p className="helper-text">No authentication providers found. Make sure your settings are configured correctly.</p>
        )}

        {providers.length > 0 && (
          <Tabs tabs={tabs} activeTab={activeProviderId?.toString() || ""} onTabChange={handleTabChange}>
            {activeData?.error ? <div className="status error">{activeData.error}</div> : null}

            {activeData?.isLoading && <p className="helper-text">Loading users...</p>}

            {!activeData?.error && !activeData?.isLoading && activeData && activeData.users.length === 0 && (
              <p className="helper-text">No users found for this authentication provider.</p>
            )}

            {activeData && activeData.users.length > 0 && (
              <UserTable 
                users={activeData.users} 
                onUserSelect={setSelectedUser} 
                selectedUserIds={selectedUserIds}
                onSelectionChange={setSelectedUserIds}
              />
            )}
          </Tabs>
        )}
      </div>

      <EditUserModal key={selectedUser?.id} user={selectedUser} onClose={() => setSelectedUser(null)} onSuccess={handleRefresh} />
    </section>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unable to reach SAFEQ Cloud. Confirm your tenant URL and API key.";
}

export default UsersPage;
