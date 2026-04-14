import { useState, useRef } from 'react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  Trash2,
  FolderPlus,
  RefreshCw,
  FileIcon,
  FolderIcon,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

export const GoogleDriveManager = () => {
  const {
    isInitialized,
    isAuthenticated,
    isLoading,
    files,
    authenticate,
    uploadFile,
    loadFiles,
    deleteFile,
    createFolder,
    downloadFile,
  } = useGoogleDrive();

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      await loadFiles();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (selectedFile) {
      await deleteFile(selectedFile.id, selectedFile.name);
      setShowDeleteDialog(false);
      setSelectedFile(null);
    }
  };

  const handleCreateFolder = async () => {
    if (folderName.trim()) {
      await createFolder(folderName);
      setFolderName('');
      setShowCreateFolder(false);
      await loadFiles();
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'N/A';
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('folder')) return <FolderIcon className="h-5 w-5 text-yellow-500" />;
    return <FileIcon className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Google Drive Integration</CardTitle>
          <CardDescription>
            Manage your files and folders in Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInitialized && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Google Drive is not configured. Please add your Google API credentials to .env file.
              </p>
            </div>
          )}

          {isInitialized && !isAuthenticated && (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                Connect your Google Drive account to start managing files
              </p>
              <Button onClick={authenticate} disabled={isLoading}>
                Connect Google Drive
              </Button>
            </div>
          )}

          {isAuthenticated && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  onClick={() => setShowCreateFolder(true)}
                  disabled={isLoading}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadFiles()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {showCreateFolder && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Folder name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCreateFolder(false);
                    setFolderName('');
                  }}>
                    Cancel
                  </Button>
                </div>
              )}

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No files found. Upload a file to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="flex items-center gap-2">
                            {getFileIcon(file.mimeType)}
                            <span className="font-medium">{file.name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {file.mimeType.split('/').pop()?.toUpperCase() || 'FOLDER'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatFileSize(file.size)}</TableCell>
                          <TableCell>
                            {format(new Date(file.modifiedTime), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {file.webViewLink && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(file.webViewLink, '_blank')}
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              {!file.mimeType.includes('folder') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => downloadFile(file.id, file.name)}
                                  disabled={isLoading}
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedFile(file);
                                  setShowDeleteDialog(true);
                                }}
                                disabled={isLoading}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedFile?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedFile(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
