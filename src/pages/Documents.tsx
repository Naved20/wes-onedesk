import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Plus, Trash2, Edit, Search, Link as LinkIcon, ExternalLink, LayoutGrid, Table as TableIcon, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { ReactQuillWrapper } from "@/components/ui/react-quill-wrapper";

// Custom styles for Quill editor
const editorStyle = `
  .ql-container {
    min-height: 150px;
    font-size: 14px;
  }
  .ql-editor {
    min-height: 150px;
  }
  .ql-toolbar {
    border-top-left-radius: 0.375rem;
    border-top-right-radius: 0.375rem;
  }
  .ql-container {
    border-bottom-left-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }
`;

type CompanyDocument = Database["public"]["Tables"]["company_documents"]["Row"];

export default function Documents() {
  const { role, user } = useAuth();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CompanyDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    document_type: "Policy Documents",
    document_link: "",
    custom_type: "",
  });
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [showCustomType, setShowCustomType] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [sortField, setSortField] = useState<"title" | "type" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Add custom styles
  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = editorStyle;
    document.head.appendChild(styleTag);
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("company_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("document_types")
        .select("type_name")
        .order("type_name");

      if (error) throw error;
      const types = data?.map(d => d.type_name) || [];
      setDocumentTypes(types);
    } catch (error) {
      console.error("Error fetching document types:", error);
      // Set default types if table doesn't exist yet
      setDocumentTypes(["Policy Documents", "Procedures", "Guidelines", "Forms", "Reports"]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    // Handle custom type
    let finalDocumentType = formData.document_type;
    if (formData.document_type === "Other" && formData.custom_type.trim()) {
      finalDocumentType = formData.custom_type.trim();
      
      // Save custom type to document_types table
      try {
        await supabase
          .from("document_types")
          .insert({ type_name: finalDocumentType, created_by: user?.id })
          .select()
          .single();
        
        // Refresh document types
        fetchDocumentTypes();
      } catch (error: any) {
        // Ignore duplicate errors (type already exists)
        if (!error.message?.includes("duplicate")) {
          console.error("Error saving custom type:", error);
        }
      }
    }

    setSubmitting(true);
    try {
      if (editingDocument) {
        // Update existing document
        const { error } = await supabase
          .from("company_documents")
          .update({
            title: formData.title,
            description: formData.description || null,
            document_type: finalDocumentType,
            document_link: formData.document_link || null,
            updated_by: user?.id,
          })
          .eq("id", editingDocument.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Document updated successfully",
        });
      } else {
        // Create new document
        const { error } = await supabase
          .from("company_documents")
          .insert({
            user_id: user?.id,
            title: formData.title,
            description: formData.description || null,
            document_type: finalDocumentType,
            document_link: formData.document_link || null,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Document created successfully",
        });
      }

      setFormData({ 
        title: "", 
        description: "", 
        document_type: "Policy Documents",
        document_link: "",
        custom_type: "",
      });
      setShowCustomType(false);
      setEditingDocument(null);
      setOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error("Error saving document:", error);
      toast({
        title: "Error",
        description: `Failed to ${editingDocument ? "update" : "create"} document`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (document: CompanyDocument) => {
    setEditingDocument(document);
    const isCustomType = !documentTypes.includes(document.document_type || "Policy Documents");
    setFormData({
      title: document.title,
      description: document.description || "",
      document_type: isCustomType ? "Other" : (document.document_type || "Policy Documents"),
      document_link: document.document_link || "",
      custom_type: isCustomType ? (document.document_type || "") : "",
    });
    setShowCustomType(isCustomType);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingDocument(null);
    setFormData({ 
      title: "", 
      description: "",
      document_type: "Policy Documents",
      document_link: "",
      custom_type: "",
    });
    setShowCustomType(false);
  };

  const handleDelete = async (documentId: string) => {
    try {
      // Delete document from database
      const { error } = await supabase
        .from("company_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const canUploadDocument = role === "admin" || role === "manager";
  const canDeleteDocument = role === "admin" || role === "manager";

  // Filter documents based on search query and type
  const filteredDocuments = documents.filter((doc) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const titleMatch = doc.title.toLowerCase().includes(query);
      const descriptionMatch = doc.description?.toLowerCase().includes(query);
      if (!titleMatch && !descriptionMatch) return false;
    }
    
    // Type filter
    if (selectedTypeFilter !== "all") {
      if (doc.document_type !== selectedTypeFilter) return false;
    }
    
    return true;
  });

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "type":
        const typeA = a.document_type || "";
        const typeB = b.document_type || "";
        comparison = typeA.localeCompare(typeB);
        break;
      case "date":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Handle sort column click
  const handleSort = (field: "title" | "type" | "date") => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon
  const getSortIcon = (field: "title" | "type" | "date") => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortOrder === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            <p className="text-muted-foreground">Upload and manage company documents</p>
          </div>
          {canUploadDocument && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingDocument(null);
                  setFormData({ title: "", description: "" });
                  setOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingDocument ? "Edit Document" : "Create New Document"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter document title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document_type">Document Type</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) => {
                        setFormData({ ...formData, document_type: value });
                        setShowCustomType(value === "Other");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other">Other (Custom Type)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {showCustomType && (
                    <div className="space-y-2">
                      <Label htmlFor="custom_type">Custom Type Name</Label>
                      <Input
                        id="custom_type"
                        placeholder="Enter custom document type"
                        value={formData.custom_type}
                        onChange={(e) => setFormData({ ...formData, custom_type: e.target.value })}
                        required={showCustomType}
                      />
                      <p className="text-xs text-muted-foreground">
                        This type will be saved and available for future documents
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="document_link">Document Link (Optional)</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="document_link"
                        type="url"
                        placeholder="https://example.com/document.pdf"
                        value={formData.document_link}
                        onChange={(e) => setFormData({ ...formData, document_link: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add a link to an external document or file
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <div className="border rounded-md">
                      <ReactQuillWrapper
                        theme="snow"
                        value={formData.description}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                        className="bg-white dark:bg-gray-950"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting 
                        ? (editingDocument ? "Updating..." : "Creating...") 
                        : (editingDocument ? "Update Document" : "Create Document")
                      }
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            {/* Type Filter */}
            <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("cards")}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                className="rounded-l-none"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchQuery.trim() 
                  ? `No documents found matching "${searchQuery}"`
                  : "No documents uploaded yet."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Cards View */}
            {viewMode === "cards" && (
              <div className="space-y-4">
                {sortedDocuments.map((document) => (
                  <Card key={document.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <CardTitle className="text-xl">{document.title}</CardTitle>
                          {document.document_type && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {document.document_type}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(document.created_at), "MMM dd, yyyy")}
                          </span>
                          {canUploadDocument && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEdit(document)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteDocument && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this document? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(document.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {document.document_link && (
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a
                            href={document.document_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                          >
                            {document.document_link}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      )}
                      {document.description && (
                        <div 
                          className="text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: document.description }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">
                          <button
                            onClick={() => handleSort("title")}
                            className="flex items-center hover:text-foreground transition-colors font-medium"
                          >
                            Title
                            {getSortIcon("title")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[15%]">
                          <button
                            onClick={() => handleSort("type")}
                            className="flex items-center hover:text-foreground transition-colors font-medium"
                          >
                            Type
                            {getSortIcon("type")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[20%]">Link</TableHead>
                        <TableHead className="w-[15%]">
                          <button
                            onClick={() => handleSort("date")}
                            className="flex items-center hover:text-foreground transition-colors font-medium"
                          >
                            Date
                            {getSortIcon("date")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[10%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDocuments.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div>{document.title}</div>
                              {document.description && (
                                <div 
                                  className="text-xs text-muted-foreground line-clamp-2"
                                  dangerouslySetInnerHTML={{ 
                                    __html: document.description.replace(/<[^>]*>/g, '').substring(0, 100) + '...' 
                                  }}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {document.document_type && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {document.document_type}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {document.document_link ? (
                              <a
                                href={document.document_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                <LinkIcon className="h-3 w-3" />
                                View
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(document.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canUploadDocument && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(document)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteDocument && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this document? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(document.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
