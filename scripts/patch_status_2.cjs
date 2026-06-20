const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Replace getTaskStatus
const oldGetTaskStatus = `  const getTaskStatus = (task: Task) => {
    const taskResponses = responses[task.id] || [];
    const userResponse = taskResponses.find(r => r.user_id === user?.id);
    const taskRemarks = userResponse ? (remarks[userResponse.id] || []) : [];
    const hasRemark = taskRemarks.length > 0;
    
    if (userResponse && hasRemark) {
      return "Reviewed";
    } else if (userResponse && !hasRemark) {
      return "Submitted";
    } else {
      if (task.due_date && new Date(task.due_date) > new Date()) {
        return "Upcoming";
      } else {
        return "To-Do";
      }
    }
  };`;

const newGetTaskStatus = `  const getTaskStatus = (task: Task) => {
    const taskResponses = responses[task.id] || [];
    const userResponse = taskResponses.find(r => r.user_id === user?.id);
    const taskRemarks = userResponse ? (remarks[userResponse.id] || []) : [];
    const hasRemark = taskRemarks.length > 0;
    
    if (userResponse && hasRemark) {
      return "Reviewed";
    } else if (userResponse && !hasRemark) {
      return "Pending Review";
    } else {
      if (!task.due_date) {
        return "To-Do";
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        return "Missed";
      } else if (dueDate > today) {
        return "Upcoming";
      } else {
        return "To-Do";
      }
    }
  };`;

code = code.replace(oldGetTaskStatus, newGetTaskStatus);

// 2. Replace TabsList
const oldTabsList = `<TabsList className="grid w-full sm:w-auto grid-cols-2 md:grid-cols-4 lg:inline-flex bg-muted/50 p-1 rounded-lg">
                    <TabsTrigger value="To-Do" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">To-Do</TabsTrigger>
                    <TabsTrigger value="Upcoming" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Upcoming</TabsTrigger>
                    <TabsTrigger value="Submitted" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Submitted</TabsTrigger>
                    <TabsTrigger value="Reviewed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Reviewed</TabsTrigger>
                  </TabsList>`;

const newTabsList = `<TabsList className="flex flex-wrap w-full sm:w-auto bg-muted/50 p-1 rounded-lg gap-1">
                    <TabsTrigger value="To-Do" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">To-Do</TabsTrigger>
                    <TabsTrigger value="Pending Review" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Pending Review</TabsTrigger>
                    <TabsTrigger value="Reviewed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Reviewed</TabsTrigger>
                    <TabsTrigger value="Upcoming" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Upcoming</TabsTrigger>
                    <TabsTrigger value="Missed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Missed</TabsTrigger>
                  </TabsList>`;

code = code.replace(oldTabsList, newTabsList);

// 3. Replace Table Badges
const oldBadge = `                        <Badge 
                          variant="secondary" 
                          className={
                            getTaskStatus(task) === "Reviewed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            getTaskStatus(task) === "Submitted" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : 
                            getTaskStatus(task) === "To-Do" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" // Upcoming
                          }
                        >`;

const newBadge = `                        <Badge 
                          variant="secondary" 
                          className={
                            getTaskStatus(task) === "Reviewed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            getTaskStatus(task) === "Pending Review" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : 
                            getTaskStatus(task) === "Missed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                            getTaskStatus(task) === "To-Do" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" // Upcoming
                          }
                        >`;

code = code.replace(oldBadge, newBadge);

fs.writeFileSync('src/pages/Tasks.tsx', code);
console.log("Successfully applied updates!");
