// Utility to get all available routes for Quick Links dropdown
// This list is manually maintained but can be extended

export interface AvailableRoute {
  value: string;
  label: string;
  category?: string;
}

export const getAvailableRoutes = (): AvailableRoute[] => {
  return [
    // Main Pages
    { value: "/dashboard", label: "Dashboard", category: "Main" },
    { value: "/employees", label: "Employees", category: "Main" },
    { value: "/attendance", label: "Attendance", category: "Main" },
    { value: "/leaves", label: "Leaves", category: "Main" },
    { value: "/tasks", label: "Tasks", category: "Main" },
    { value: "/salaries", label: "Salaries", category: "Main" },
    { value: "/performance", label: "Performance", category: "Main" },
    { value: "/announcements", label: "Announcements", category: "Main" },
    { value: "/documents", label: "Documents", category: "Main" },
    
    // Admin Pages
    { value: "/institutions", label: "Institutions", category: "Admin" },
    { value: "/shifts", label: "Shift Management", category: "Admin" },
    { value: "/shift-assignments", label: "Employee Shift Assignment", category: "Admin" },
    { value: "/peer-reviewer-groups", label: "Peer Reviewer Groups", category: "Admin" },
    { value: "/quick-links", label: "Quick Links Admin", category: "Admin" },
    { value: "/face-id-management", label: "Face ID Management", category: "Admin" },
    
    // Face Attendance
    { value: "/face-hub", label: "Face Hub", category: "Face Attendance" },
    { value: "/face-attendance", label: "Face Attendance", category: "Face Attendance" },
    
    // Other
    { value: "/google-drive", label: "Google Drive", category: "Other" },
    { value: "/settings", label: "Settings", category: "Other" },
    { value: "/settings/account", label: "Account Info", category: "Settings" },
    { value: "/settings/password", label: "Change Password", category: "Settings" },
    { value: "/settings/notifications", label: "Notifications", category: "Settings" },
    { value: "/settings/privacy", label: "Privacy", category: "Settings" },
    { value: "/settings/appearance", label: "Appearance", category: "Settings" },
    { value: "/settings/language", label: "Language", category: "Settings" },
    { value: "/settings/support", label: "Support Requests", category: "Settings" },
  ];
};

// Get routes grouped by category
export const getGroupedRoutes = () => {
  const routes = getAvailableRoutes();
  const grouped: Record<string, AvailableRoute[]> = {};
  
  routes.forEach(route => {
    const category = route.category || "Other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(route);
  });
  
  return grouped;
};
