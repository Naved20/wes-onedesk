const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Update the Table Headers
const oldHeaders = `                          { key: "status", label: role === "employee" ? "Your Status" : "Status", show: true },
                          { key: "completion", label: "Completion", show: role === "admin" || role === "manager" },`;

const newHeaders = `                          { key: "status", label: "Your Status", show: role === "employee" },
                          { key: "completion", label: "Completion", show: role === "admin" || role === "manager" },
                          { key: "reviewed", label: "Reviewed", show: role === "admin" || role === "manager" },`;

code = code.replace(oldHeaders, newHeaders);

// 2. Add reviewedCount and reviewedPct
const oldCounts = `              const assignedCount = assignments[task.id]?.length || 0;
              const respondedCount = taskResponses.length;
              const completionPct = assignedCount ? Math.round((respondedCount / assignedCount) * 100) : 0;`;

const newCounts = `              const assignedCount = assignments[task.id]?.length || 0;
              const respondedCount = taskResponses.length;
              const completionPct = assignedCount ? Math.round((respondedCount / assignedCount) * 100) : 0;
              const reviewedCount = taskResponses.filter(r => (remarks[r.id] || []).length > 0).length;
              const reviewedPct = respondedCount ? Math.round((reviewedCount / respondedCount) * 100) : 0;`;

code = code.replace(oldCounts, newCounts);

// 3. Replace TableCell logic for Status and Completion
const oldCells = `                    <TableCell>
                      {role === "employee" ? (
                        <Badge 
                          variant="secondary" 
                          className={
                            getTaskStatus(task) === "Reviewed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            getTaskStatus(task) === "Pending Review" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : 
                            getTaskStatus(task) === "Missed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                            getTaskStatus(task) === "To-Do" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" // Upcoming
                          }
                        >
                          {getTaskStatus(task)}
                        </Badge>
                      ) : (
                        <Badge variant={task.is_active ? "default" : "secondary"} className={task.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100" : ""}>
                          {task.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    {(role === "admin" || role === "manager") && (
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: \`\${completionPct}%\` }} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {respondedCount}/{assignedCount || 0}
                          </span>
                        </div>
                      </TableCell>
                    )}`;

const newCells = `                    {role === "employee" && (
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={
                            getTaskStatus(task) === "Reviewed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            getTaskStatus(task) === "Pending Review" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : 
                            getTaskStatus(task) === "Missed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                            getTaskStatus(task) === "To-Do" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" // Upcoming
                          }
                        >
                          {getTaskStatus(task)}
                        </Badge>
                      </TableCell>
                    )}
                    {(role === "admin" || role === "manager") && (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: \`\${completionPct}%\` }} />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {respondedCount}/{assignedCount || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: \`\${reviewedPct}%\` }} />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {reviewedCount}/{respondedCount || 0}
                            </span>
                          </div>
                        </TableCell>
                      </>
                    )}`;

if (code.includes(oldCells)) {
  code = code.replace(oldCells, newCells);
  fs.writeFileSync('src/pages/Tasks.tsx', code);
  console.log("Successfully replaced table cells!");
} else {
  console.log("Could not find table cells!");
}
