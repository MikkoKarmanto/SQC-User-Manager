import { useCallback, useEffect, useState, useMemo } from "react";
import { listAuthProviders, listUsersForProvider, generateBulkPins, generateBulkOtps } from "../services/safeqClient";
import { extractUsers, type SafeQAuthProvider, type SafeQUser } from "../types/safeq";
import UserTable from "../components/UserTable";
import EditUserModal from "../components/EditUserModal";
import Tabs, { type Tab } from "../components/Tabs";
import UserFilters, { type FilterOptions, type SortField, type SortDirection } from "../components/UserFilters";
import BulkActionsBar from "../components/BulkActionsBar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortField, setSortField] = useState<SortField>("userName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    // Clear selection and filters when switching tabs
    setSelectedUserIds(new Set());
    setSearchQuery("");
    setFilters({});
  };

  const handleSortChange = (field: SortField, direction?: SortDirection) => {
    if (direction) {
      setSortField(field);
      setSortDirection(direction);
    } else {
      // Toggle direction if clicking same field
      if (field === sortField) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    }
  };

  // Filter and search users while preserving selection
  const filteredUsers = useMemo(() => {
    if (!activeProviderId) return [];
    
    const activeData = providerData.get(activeProviderId);
    if (!activeData) return [];
    
    let result = activeData.users;
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user => 
        user.userName?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply filters
    if (filters.hasEmail !== null && filters.hasEmail !== undefined) {
      result = result.filter(user => 
        filters.hasEmail ? !!user.email : !user.email
      );
    }
    
    if (filters.hasCard !== null && filters.hasCard !== undefined) {
      result = result.filter(user => 
        filters.hasCard ? (user.cards && user.cards.length > 0) : (!user.cards || user.cards.length === 0)
      );
    }
    
    if (filters.hasPin !== null && filters.hasPin !== undefined) {
      result = result.filter(user => 
        filters.hasPin ? !!user.shortId : !user.shortId
      );
    }
    
    if (filters.hasOtp !== null && filters.hasOtp !== undefined) {
      result = result.filter(user => 
        filters.hasOtp ? !!user.otp : !user.otp
      );
    }
    
    return result;
  }, [activeProviderId, providerData, searchQuery, filters]);

  const selectedUsers = useMemo(() => {
    if (!activeProviderId) return [];
    const activeData = providerData.get(activeProviderId);
    if (!activeData) return [];
    
    return activeData.users.filter(user => selectedUserIds.has(user.id));
  }, [activeProviderId, providerData, selectedUserIds]);

  const handleBulkGeneratePins = async () => {
    if (selectedUsers.length === 0) return;
    
    setIsBulkProcessing(true);
    setBulkMessage(null);
    
    try {
      const usersToUpdate = selectedUsers.map(user => ({
        userName: user.userName,
        providerId: user.providerId || null,
      }));
      
      const result = await generateBulkPins(usersToUpdate);
      
      if (result.failed > 0) {
        setBulkMessage({
          type: "error",
          text: `PIN generation completed: ${result.success} successful, ${result.failed} failed`,
        });
      } else {
        setBulkMessage({
          type: "success",
          text: `Successfully generated PINs for ${result.success} user${result.success !== 1 ? "s" : ""}`,
        });
      }
      
      // Refresh users after bulk operation
      if (activeProviderId) {
        await fetchUsersForProvider(activeProviderId);
      }
    } catch (err) {
      setBulkMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to generate PINs",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkGenerateOtps = async () => {
    if (selectedUsers.length === 0) return;
    
    setIsBulkProcessing(true);
    setBulkMessage(null);
    
    try {
      const usersToUpdate = selectedUsers.map(user => ({
        userName: user.userName,
        providerId: user.providerId || null,
      }));
      
      const result = await generateBulkOtps(usersToUpdate);
      
      if (result.failed > 0) {
        setBulkMessage({
          type: "error",
          text: `OTP generation completed: ${result.success} successful, ${result.failed} failed`,
        });
      } else {
        setBulkMessage({
          type: "success",
          text: `Successfully generated OTPs for ${result.success} user${result.success !== 1 ? "s" : ""}`,
        });
      }
      
      // Refresh users after bulk operation
      if (activeProviderId) {
        await fetchUsersForProvider(activeProviderId);
      }
    } catch (err) {
      setBulkMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to generate OTPs",
      });
    } finally {
      setIsBulkProcessing(false);
    }
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
  const totalUsers = activeData?.users.length || 0;

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
          {activeData && !activeData.isLoading && (
            <span className="timestamp">
              {filteredUsers.length !== totalUsers ? `${filteredUsers.length} of ${totalUsers}` : totalUsers} users
            </span>
          )}
        </div>

        {providersError ? <div className="status error">{providersError}</div> : null}

        {bulkMessage && <div className={`status ${bulkMessage.type}`}>{bulkMessage.text}</div>}

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
              <>
                <UserFilters
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filters={filters}
                  onFiltersChange={setFilters}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                  totalUsers={totalUsers}
                  filteredUsers={filteredUsers.length}
                />
                <UserTable 
                  users={filteredUsers} 
                  onUserSelect={setSelectedUser} 
                  selectedUserIds={selectedUserIds}
                  onSelectionChange={setSelectedUserIds}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSortChange={(field) => handleSortChange(field)}
                />
                <BulkActionsBar
                  selectedCount={selectedUserIds.size}
                  onGeneratePins={handleBulkGeneratePins}
                  onGenerateOtps={handleBulkGenerateOtps}
                  onClearSelection={() => setSelectedUserIds(new Set())}
                  isProcessing={isBulkProcessing}
                />
              </>
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
