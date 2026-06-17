import { useState } from "react";
import { WESChallenge } from "@/types/wesWeeklyReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, Loader2, AlertTriangle } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WESChallengeManagerProps {
  weeklyReportId: string;
  challenges: WESChallenge[];
  isEditable: boolean;
  onUpdate: () => void;
}

const WESChallengeManager = ({
  weeklyReportId,
  challenges,
  isEditable,
  onUpdate,
}: WESChallengeManagerProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newChallenge, setNewChallenge] = useState({
    challenge_description: "",
    solution_applied: "",
  });

  const handleAddChallenge = async () => {
    if (!newChallenge.challenge_description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter challenge description",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await wesWeeklyReportService.createChallenge(weeklyReportId, newChallenge);
      toast({ title: "Success", description: "Challenge added" });
      setNewChallenge({ challenge_description: "", solution_applied: "" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add challenge",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    try {
      await wesWeeklyReportService.deleteChallenge(challengeId);
      toast({ title: "Success", description: "Challenge deleted" });
      setDeleteId(null);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete challenge",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Challenges & Solutions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Document any challenges faced during the week and solutions applied
          </p>
        </CardContent>
      </Card>

      {/* Add New Challenge */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Challenge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Challenge Description *</Label>
              <Textarea
                value={newChallenge.challenge_description}
                onChange={(e) =>
                  setNewChallenge({ ...newChallenge, challenge_description: e.target.value })
                }
                placeholder="Describe the challenge faced..."
                rows={3}
              />
            </div>

            <div>
              <Label>Solution Applied</Label>
              <Textarea
                value={newChallenge.solution_applied}
                onChange={(e) =>
                  setNewChallenge({ ...newChallenge, solution_applied: e.target.value })
                }
                placeholder="Describe the solution or actions taken..."
                rows={3}
              />
            </div>

            <Button onClick={handleAddChallenge} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Challenge
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing Challenges */}
      <div className="space-y-4">
        {challenges.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No challenges documented yet</p>
            </CardContent>
          </Card>
        ) : (
          challenges.map((challenge, index) => (
            <Card key={challenge.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">Challenge #{index + 1}</CardTitle>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(challenge.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Challenge</Label>
                  <p className="mt-2">{challenge.challenge_description}</p>
                </div>

                {challenge.solution_applied && (
                  <div>
                    <Label className="text-muted-foreground">Solution Applied</Label>
                    <p className="mt-2">{challenge.solution_applied}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Added: {new Date(challenge.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challenge?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The challenge will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDeleteChallenge(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WESChallengeManager;
