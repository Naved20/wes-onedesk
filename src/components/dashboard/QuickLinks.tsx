import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, ExternalLink, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

export function QuickLinks() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("quick_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setLinks(data || []);
      setLoading(false);
    })();
  }, []);

  const handleClick = (url: string) => {
    if (url.startsWith("http")) window.open(url, "_blank", "noopener,noreferrer");
    else navigate(url);
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Quick Links
          </CardTitle>
          <CardDescription>Important shortcuts in one place</CardDescription>
        </div>
        {role === "admin" && (
          <Button variant="outline" size="sm" onClick={() => navigate("/quick-links")}>
            <SettingsIcon className="h-4 w-4 mr-1" /> Manage
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {role === "admin"
              ? "No quick links yet. Click Manage to add some."
              : "No quick links configured yet."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => handleClick(link.url)}
                className="p-4 rounded-lg border bg-card hover:bg-muted transition-colors text-left flex items-start gap-3"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{link.label}</h3>
                  {link.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{link.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
