const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Initial activeTab state
code = code.replace(
  'const [activeTab, setActiveTab] = useState<string>("Upcoming");',
  'const [activeTab, setActiveTab] = useState<string>("To-Do");'
);

// 2. Add getTaskStatus function just before the filteredTasks calculation
const getTaskStatusCode = `
  const getTaskStatus = (task: Task) => {
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
  };
`;

// Find where filteredTasks starts and insert the function before it, or just at the top of the component
code = code.replace(
  '  const handleSort = (field: string) => {',
  getTaskStatusCode + '\n  const handleSort = (field: string) => {'
);

// 3. Update the filteredTasks logic to use getTaskStatus
const oldFilterLogic = `                const taskResponses = responses[task.id] || [];
                // Admin can see the global status based on their own response if they responded,
                // otherwise we assume it's for them personally.
                const userResponse = taskResponses.find(r => r.user_id === user?.id);
                const taskRemarks = userResponse ? (remarks[userResponse.id] || []) : [];
                const hasRemark = taskRemarks.length > 0;
                const isPastDue = task.due_date ? new Date(task.due_date) < new Date() : false;

                let taskStatus = "Upcoming";
                if (userResponse && hasRemark) {
                  taskStatus = "Complete";
                } else if (userResponse && !hasRemark) {
                  taskStatus = "Submitted / Pending Review";
                } else if (!userResponse && isPastDue) {
                  taskStatus = "Missed";
                }

                return activeTab === taskStatus;`;

const newFilterLogic = `                const taskStatus = getTaskStatus(task);
                return activeTab === taskStatus;`;

code = code.replace(oldFilterLogic, newFilterLogic);

// 4. Update the Tabs
const oldTabs = `                    <TabsTrigger value="Upcoming" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Upcoming</TabsTrigger>
                    <TabsTrigger value="Submitted / Pending Review" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Submitted / Pending Review</TabsTrigger>
                    <TabsTrigger value="Complete" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Complete</TabsTrigger>
                    <TabsTrigger value="Missed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Missed</TabsTrigger>`;

const newTabs = `                    <TabsTrigger value="To-Do" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">To-Do</TabsTrigger>
                    <TabsTrigger value="Upcoming" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Upcoming</TabsTrigger>
                    <TabsTrigger value="Submitted" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Submitted</TabsTrigger>
                    <TabsTrigger value="Reviewed" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm font-medium transition-all">Reviewed</TabsTrigger>`;

code = code.replace(oldTabs, newTabs);

// 5. Update the "Your Status" Badge inside the table
const oldBadge = `                      {role === "employee" ? (
                        <Badge variant={userResponse ? "default" : "secondary"} className={userResponse ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
                          {userResponse ? "✓ Completed" : "Pending"}
                        </Badge>
                      ) : (`;

const newBadge = `                      {role === "employee" ? (
                        <Badge 
                          variant="secondary" 
                          className={
                            getTaskStatus(task) === "Reviewed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            getTaskStatus(task) === "Submitted" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : 
                            getTaskStatus(task) === "To-Do" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" // Upcoming
                          }
                        >
                          {getTaskStatus(task)}
                        </Badge>
                      ) : (`;

code = code.replace(oldBadge, newBadge);

fs.writeFileSync('src/pages/Tasks.tsx', code);
console.log('Patch complete!');
