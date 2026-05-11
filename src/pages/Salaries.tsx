import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { SalaryManagement } from "@/components/salary/SalaryManagement";
import { EmployeeSalaryView } from "@/components/salary/EmployeeSalaryView";

export default function Salaries() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = !isAdmin && !isManager;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salaries</h1>
          <p className="text-muted-foreground">
            {isEmployee 
              ? "View your salary details and breakdown" 
              : "View and manage employee salary information"}
          </p>
        </div>

        {user && isEmployee ? (
          <EmployeeSalaryView userId={user.id} isAdmin={false} />
        ) : user && (isAdmin || isManager) ? (
          <SalaryManagement 
            userId={user.id} 
            isAdmin={isAdmin} 
            isManager={isManager} 
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Please log in to view salary information.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
