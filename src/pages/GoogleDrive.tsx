import { GoogleDriveManager } from '@/components/GoogleDriveManager';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const GoogleDrive = () => {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Google Drive</h1>
          <p className="text-muted-foreground mt-2">
            Manage your files and folders stored in Google Drive
          </p>
        </div>
        <GoogleDriveManager />
      </div>
    </DashboardLayout>
  );
};

export default GoogleDrive;
