document.addEventListener("DOMContentLoaded", () => {
    const taskList = document.getElementById("taskList");
    const addTaskButton = document.getElementById("addTask");
    const folderSelect = document.getElementById("folderSelect");
    const addFolderButton = document.getElementById("addFolder");

    chrome.storage.sync.get(["folders", "tasks"], (data) => {
        const folders = data.folders || ["Default"];
        const tasks = data.tasks || [];
        
        folders.forEach(folder => addFolderToUI(folder));
        updateTaskList(tasks);
    });

    folderSelect.addEventListener("change", () => {
        chrome.storage.sync.get(["tasks"], (data) => {
            updateTaskList(data.tasks || []);
        });
    });

    addFolderButton.addEventListener("click", () => {
        const folderName = prompt("Enter Folder Name:");
        if (folderName) {
            chrome.storage.sync.get(["folders"], (data) => {
                let folders = data.folders || [];
                if (!folders.includes(folderName)) {
                    folders.push(folderName);
                    chrome.storage.sync.set({"folders": folders});
                    addFolderToUI(folderName);
                }
            });
        }
    });

    addTaskButton.addEventListener("click", () => {
        const taskName = prompt("Enter Task Name:");
        const dueDate = prompt("Enter Due Date");
        const color = prompt("Enter Task Color:");
        const folder = folderSelect.value;
        const recurring = confirm("Should this task have a recurring daily reminder?");

        if (taskName && dueDate && color) {
            const parsedDate = new Date(dueDate);
            if (isNaN(parsedDate.getTime())) {
                alert("Invalide Time Format");
                return;
            }
            const task = {name: taskName, dueDate: parsedDate.toISOString(), color, folder, recurring, completed: false};
            addTaskToUI(task);
            saveTask(task);
            //scheduleNotification(task);
            //updateTaskList([...document.taskList, task]);
        }
    });

    function updateTaskList(tasks) {
        taskList.innerHTML = "";
        const selectedFolder = folderSelect.value;
        tasks.filter(task => task.folder === selectedFolder).forEach(task => addTaskToUI(task));
    }

    function addFolderToUI(folder) {
        const option = document.createElement("option");
        option.value = folder;
        option.textContent = folder;
        folderSelect.appendChild(option);
    }

    function addTaskToUI(task) {
        const taskItem = document.createElement("li");
        taskItem.innerHTML = `<strong>${task.name}</strong><br>Due: ${new Date(task.dueDate).toLocaleString()}`;
        taskItem.style.color = task.color;

        const buttonsDiv = document.createElement("div");
        buttonsDiv.classList.add("task-buttons");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.onclick = () => editTask(task, taskItem);

        const completeButton = document.createElement("button");
        completeButton.textContent = "Mark Complete";
        completeButton.onclick = () => markComplete(task, taskItem);

        buttonsDiv.appendChild(editButton);
        buttonsDiv.appendChild(completeButton);
        taskItem.appendChild(buttonsDiv);
        taskList.appendChild(taskItem);
    }

    function saveTask(task) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks || [];
            tasks.push(task);
            chrome.storage.sync.set({"tasks": tasks});
        });
    }

    function scheduleNotification(task) {
        const parsedDate = new Date(task.dueDate);
        if (isNaN(parsedDate.getTime())) {
            console.error("Invalid Due Date for Task", task);
            return;
        }
        const dueTime = parsedDate.getTime();
        if (isNaN(dueTime)) {
            console.error("Falied to parse dueTime for:", task);
            return;
        }
        const now = Date.now();
        const timeUntilDue = dueTime - now;
        if (timeUntilDue > 0) {
            chrome.alarms.create(task.name, {when: dueTime});
            if (task.recurring) {
                chrome.alarms.create(task.name, {periodInMinutes: 1440});
            }
        }
    }

    function editTask(task, taskItem) {
        const editOptions = prompt("What would you like to edit? (name, due date, color)");
        if (!editOptions) return;
        let newTaskName = task.name;
        let newDueDate = task.dueDate;
        let newColor = task.color;

        if (editOptions.includes("name")){
            newTaskName = prompt("Edit Task Name:", task.name) || task.name;
        }
        if (editOptions.includes("due date")) {
            const newDateInput = prompt("Edit Due Date:", new Date(task.dueDate).toISOString().slice(0, 16));
            const parsedDate = new Date(newDateInput);
            
            if (!isNaN(parsedDate.getTime())) {
                newDueDate = parsedDate.toISOString();
            } else {
                alert("Invalid Date Format");
            }
        }
        if (editOptions.includes("color")) {
            newColor = prompt("Edit Task Color:", task.color) || task.color;
        }

        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks || [];
            const index = tasks.findIndex(t => t.name === task.name);
            if (index > -1) {
                tasks[index].name = newTaskName;
                tasks[index].dueDate = newDueDate;
                tasks[index].newColor = newColor;
                    
                chrome.storage.sync.set({"tasks": tasks}, () => {
                    updateTaskList(tasks);
                });
            }
        });
    }

    function markComplete(task, taskItem) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks.filter(t => t.name !== task.name);
            chrome.storage.sync.set({"tasks": tasks}, () => {
                chrome.alarms.clear(task.name);
                taskItem.remove();
            });
        });
    }
});
