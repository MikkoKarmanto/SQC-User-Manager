import { useState } from "react";
import "./UserFilters.css";

export type SortField = "userName" | "fullName" | "email";
export type SortDirection = "asc" | "desc";

export interface FilterOptions {
  hasEmail?: boolean | null;
  hasCard?: boolean | null;
  hasPin?: boolean | null;
  hasOtp?: boolean | null;
}

interface UserFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  totalUsers: number;
  filteredUsers: number;
}

function UserFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  totalUsers,
  filteredUsers,
}: UserFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (key: keyof FilterOptions, value: boolean | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== null && v !== undefined);

  const clearFilters = () => {
    onFiltersChange({
      hasEmail: null,
      hasCard: null,
      hasPin: null,
      hasOtp: null,
    });
  };

  return (
    <div className="user-filters">
      <div className="filter-row">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by username, name, or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => onSearchChange("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <button
            type="button"
            className={`filter-toggle ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && <span className="filter-badge">•</span>}
          </button>

          <div className="sort-select">
            <label htmlFor="sort-field">Sort by:</label>
            <select
              id="sort-field"
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField, sortDirection)}
            >
              <option value="userName">Username</option>
              <option value="fullName">Full Name</option>
              <option value="email">Email</option>
            </select>
            <button
              type="button"
              className="sort-direction"
              onClick={() => onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")}
              title={sortDirection === "asc" ? "Sort descending" : "Sort ascending"}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="filter-options">
          <div className="filter-group">
            <span className="filter-label">Email:</span>
            <button
              type="button"
              className={`filter-btn ${filters.hasEmail === true ? "active" : ""}`}
              onClick={() => handleFilterChange("hasEmail", filters.hasEmail === true ? null : true)}
            >
              Has Email
            </button>
            <button
              type="button"
              className={`filter-btn ${filters.hasEmail === false ? "active" : ""}`}
              onClick={() => handleFilterChange("hasEmail", filters.hasEmail === false ? null : false)}
            >
              No Email
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-label">Card:</span>
            <button
              type="button"
              className={`filter-btn ${filters.hasCard === true ? "active" : ""}`}
              onClick={() => handleFilterChange("hasCard", filters.hasCard === true ? null : true)}
            >
              Has Card
            </button>
            <button
              type="button"
              className={`filter-btn ${filters.hasCard === false ? "active" : ""}`}
              onClick={() => handleFilterChange("hasCard", filters.hasCard === false ? null : false)}
            >
              No Card
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-label">PIN:</span>
            <button
              type="button"
              className={`filter-btn ${filters.hasPin === true ? "active" : ""}`}
              onClick={() => handleFilterChange("hasPin", filters.hasPin === true ? null : true)}
            >
              Has PIN
            </button>
            <button
              type="button"
              className={`filter-btn ${filters.hasPin === false ? "active" : ""}`}
              onClick={() => handleFilterChange("hasPin", filters.hasPin === false ? null : false)}
            >
              No PIN
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-label">OTP:</span>
            <button
              type="button"
              className={`filter-btn ${filters.hasOtp === true ? "active" : ""}`}
              onClick={() => handleFilterChange("hasOtp", filters.hasOtp === true ? null : true)}
            >
              Has OTP
            </button>
            <button
              type="button"
              className={`filter-btn ${filters.hasOtp === false ? "active" : ""}`}
              onClick={() => handleFilterChange("hasOtp", filters.hasOtp === false ? null : false)}
            >
              No OTP
            </button>
          </div>

          {hasActiveFilters && (
            <button type="button" className="clear-filters" onClick={clearFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {(searchQuery || hasActiveFilters) && (
        <div className="filter-status">
          Showing {filteredUsers} of {totalUsers} users
        </div>
      )}
    </div>
  );
}

export default UserFilters;
