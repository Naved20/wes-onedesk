import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppraisalManager } from "@/components/performance/AppraisalManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, FileText, Calendar, TrendingUp } from "lucide-react";

export default function Performance() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Reviews</h1>
          <p className="text-muted-foreground">Track and manage performance evaluations</p>
        </div>

        <Tabs defaultValue="monthly" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="weekly" disabled>
              <Calendar className="h-4 w-4 mr-2" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <FileText className="h-4 w-4 mr-2" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="annually" disabled>
              <TrendingUp className="h-4 w-4 mr-2" />
              Annually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Appraisals</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Weekly appraisal feature coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly">
            <AppraisalManager />
          </TabsContent>

          <TabsContent value="annually">
            <Card>
              <CardHeader>
                <CardTitle>Annual Appraisals</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Annual appraisal feature coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
