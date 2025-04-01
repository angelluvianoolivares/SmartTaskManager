document.addEventListener("DOMContentLoaded", () => {
    const taskList = document.getElementById("taskList");
    const addTaskButton = document.getElementById("addTask");
    const folderSelect = document.getElementById("folderSelect");
    const addFolderButton = document.getElementById("addFolder");


    //Load folders and tasks from storage
    chrome.storage.sync.get(["folders", "tasks"], (data) => {
        const folders = data.folders || ["Default"];
        const tasks = data.tasks || [];

        folders.forEach(folder => addFolderToUI(folder));
        updateTaskList(tasks);
    });


    //Update task list when folder changes
    folderSelect.addEventListener("change", () => {
        chrome.storage.sync.get(["tasks"], (data) => {
            updateTaskList(data.tasks || []);
        });
    });


    //Add new folder
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


    //Add new task
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
            
            //Generate a unique ID for the task
            const taskID = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
            const task = {
                id: taskID,
                name: taskName,
                dueDate: parsedDate.toISOString(),
                color: color,
                folder: folder,
                recurring: recurring,
                completed: false
            };
            addTaskToUI(task);
            saveTask(task);
            scheduleNotification(task);
        }
    });


    //Update the displayed list filtered by folder
    function updateTaskList(tasks) {
        taskList.innerHTML = "";
        const selectedFolder = folderSelect.value;
        tasks.filter(task => task.folder === selectedFolder).forEach(task => addTaskToUI(task));
    }


    //Add folder
    function addFolderToUI(folder) {
        const option = document.createElement("option");
        option.value = folder;
        option.textContent = folder;
        folderSelect.appendChild(option);
    }


    //Add task
    function addTaskToUI(task) {
        const taskItem = document.createElement("li");

        //Create and append task name
        const strongElem = document.createElement("strong");
        strongElem.textContent = task.name;
        taskItem.appendChild(strongElem);
        taskItem.appendChild(document.createElement("br"));

        //Append due date as text
        const dueText = document.createTextNode("Due: " + new Date(task.dueDate).toLocaleString());
        taskItem.appendChild(dueText);

        taskItem.style.color = task.color;
        
        //Create buttons container
        const buttonsDiv = document.createElement("div");
        buttonsDiv.classList.add("task-buttons");
        
        //Edit button
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.onclick = () => editTask(task, taskItem);
        
        //Mark as Complete button
        const completeButton = document.createElement("button");
        completeButton.textContent = "Mark Complete";
        completeButton.onclick = () => markComplete(task, taskItem);

        buttonsDiv.appendChild(editButton);
        buttonsDiv.appendChild(completeButton);
        taskItem.appendChild(buttonsDiv);
        taskList.appendChild(taskItem);
    }


    //Save a new task
    function saveTask(task) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks || [];
            tasks.push(task);
            chrome.storage.sync.set({"tasks": tasks});
        });
    }


    //Schedule a notification for a task using chrome alarms
    async function scheduleNotification(task) {
        const parsedDate = new Date(task.dueDate);
        if (isNaN(parsedDate.getTime())) {
            console.error("Invalid Due Date for Task", task);
            return;
        }
        const dueTime = parsedDate.getTime();
        const now = Date.now();
        const timeUntilDue = dueTime - now;
        if (timeUntilDue > 0) {
            //Use the task ID for the alarm name
            if (task.recurring) {
                chrome.alarms.create(task.id, {when: dueTime, periodInMinutes: 1440});
            } else {
                chrome.alarms.create(task.id, {when: dueTime});
            }
        }
    }


    //Edit an existing task
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
            
            //Find tasks by the task ID
            const index = tasks.findIndex(t => t.id === task.id);
            if (index > -1) {
                tasks[index].name = newTaskName;
                tasks[index].dueDate = newDueDate;
                tasks[index].color = newColor;
                    
                chrome.storage.sync.set({"tasks": tasks}, () => {
                    updateTaskList(tasks);
                });
            }
        });
    }


    //Mark task as complete and remove it from UI
    function markComplete(task, taskItem) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks.filter(t => t.id !== task.id);
            chrome.storage.sync.set({"tasks": tasks}, () => {
                chrome.alarms.clear(task.id);
                taskItem.remove();
            });
        });
    }


    //OCR and Create a Task
    async function performOCRandCreateTask(imageFile, folder) {
        const loadingIndicator = document.getElementById("loading");
        const preview = document.getElementById("imagePreview");

        loadingIndicator.textContent = "Processing Image ... this may take a few seconds";
        loadingIndicator.classList.remove("hidden");

        const reader = new FileReader();
        reader.onload = function() {
            const image = new Image();
            image.src = reader.result;
            preview.src = reader.result;
            preview.classList.remove("hidden");

            image.onload = async() => {
                try {
                    const canvas = document.createElement("canvas");
                    const scale = Math.min(600 / image.width, 1);
                    canvas.width = image.width * scale;
                    canvas.height = image.height * scale;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                    //Tesseract Worker Initialization
                    const worker = Tesseract.createWorker();
                    await worker.load();
                    await worker.loadLanguage("eng");
                    await worker.initialize("eng");
                    const {data: {text}} = await worker.recognize(canvas);
                    await worker.terminate();

                    const taskName = text.trim().split("\n")[0] || "Untitled Task";
                    //Generate a task ID for OCR-created Task
                    const taskID = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
                    const task = {
                        id: taskID,
                        name: taskName,
                        dueDate: new Date().toISOString(),
                        color: "black",
                        folder: folder,
                        recurring: false,
                        completed: false
                    };

                    chrome.storage.sync.get(["tasks"], (data) => {
                        let tasks = data.tasks || [];
                        tasks.push(task);
                        chrome.storage.sync.set({tasks}, () => {
                            updateTaskList(tasks);
                            loadingIndicator.classList.add("hidden");
                            alert("Task created successfully!");
                        });
                    });
                } catch (error) {
                    loadingIndicator.classList.add("hidden");
                    alert("An Error Occurred during OCR");
                    console.error("OCR Error:", error);
                }
            };
        };
        reader.readAsDataURL(imageFile);
    }
    

    //OCR Event Button Listener
    document.getElementById("ocrTask").addEventListener("click", () => {
        const fileInput = document.getElementById("imageUpload");
        if (fileInput.files.length === 0) {
            alert("Please upload an image.")
            return;
        }

        const folder = prompt("Enter Folder Name for Task (Optional):") || "Default";
        performOCRandCreateTask(fileInput.files[0], folder);
    });
});
