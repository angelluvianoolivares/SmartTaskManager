document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("modal");
    if (modal) {
        modal.classList.add("hidden");
    }

    const taskList = document.getElementById("taskList");
    const addTaskButton = document.getElementById("addTask");
    const folderSelect = document.getElementById("folderSelect");
    const addFolderButton = document.getElementById("addFolder");

    //Create Delete Folder Button
    const deleteFolderButton = document.createElement("button");
    deleteFolderButton.textContent = "Delete Folder";
    deleteFolderButton.classList.add("btn");
    deleteFolderButton.addEventListener("click", deleteCurrentFolder);
    folderSelect.parentElement.appendChild(deleteFolderButton);

    //Load Folders and Tasks from Chrome Storage
    chrome.storage.sync.get(["folders", "tasks"], (data) => {
        const folders = data.folders || ["Default"];
        const tasks = data.tasks || [];
        
        folders.forEach(folder => addFolderToUI(folder));
        updateTaskList(tasks);
    });

    //Update Displayed Tasks based on Selected Folder
    folderSelect.addEventListener("change", () => {
        chrome.storage.sync.get(["tasks"], (data) => {
            updateTaskList(data.tasks || []);
        });
    });

    //Add a New Folder
    addFolderButton.addEventListener("click", () => {
        const folderName = prompt("Enter Folder Name:");

        if (folderName) {
            chrome.storage.sync.get(["folders"], (data) => {
                let folders = data.folders || [];
                if (!folders.includes(folderName)) {
                    folders.push(folderName);
                    chrome.storage.sync.set({folders});
                    addFolderToUI(folderName);
                }
            });
        }
    });

    //Delete a Folder
    function deleteCurrentFolder() {
        const folderToDelete = folderSelect.value;
        if (!folderToDelete || folderToDelete === "Default") {
            alert("Cannot Delete the Default Folder.");
            return;
        }

        if (confirm(`Are you Sure you Want to Delete the Folder "${folderToDelete}" and All of Its Tasks?`)) {
            chrome.storage.sync.get(["folders", "tasks"], (data) => {
                let folders = data.folders || [];
                let tasks = data.tasks || [];
                folders = folders.filter(folder => folder !== folderToDelete);
                tasks = tasks.filter(task => task.folder !== folderToDelete);

                chrome.storage.sync.set({folders, tasks}, () => {
                    folderSelect.innerHTML = "";
                    folders.forEach(folder => addFolderToUI(folder));
                    updateTaskList(tasks);
                });
            });
        }
    }

    addTaskButton.addEventListener("click", () => {
        modal.classList.remove("hidden");
    });

    //Add a New Task
    document.getElementById("saveTask").addEventListener("click", () => {
        const taskName = document.getElementById("taskName").value;
        const dueDate = document.getElementById("dueDate").value;
        const dueTime = document.getElementById("dueTime").value;
        const color = document.getElementById("taskColor").value;
        const folder = folderSelect.value;
        const priority = document.getElementById("priority").value;
        const recurring = document.getElementById("recurring").checked;

        if (taskName && dueDate && color && priority) {
            const dueDateTime = new Date(`${dueDate}T${dueTime}`);
            if (isNaN(dueDateTime.getTime())) {
                alert("Invalid Time Format");
                return;
            }

            //Generate Unique Task ID for Every Task
            const taskID = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
            const task = {
                id: taskID,
                name: taskName,
                dueDate: dueDateTime.toISOString(),
                color: color,
                folder: folder,
                priority: priority,
                recurring: recurring,
                completed: false
            };

            //Save Task to Storage
            chrome.storage.sync.get(["tasks"], (data) => {
                let tasks = data.tasks || [];
                tasks.push(task);
                chrome.storage.sync.set({tasks}, () => {
                    updateTaskList(tasks);
                    scheduleNotification(task);
                    document.getElementById("modal").classList.add("hidden");
                    resetForm();
                });
            });
        } else {
            alert("Please Fill Out All the Fields!");
        }
    });

    document.getElementById("cancelTask").addEventListener("click", () => {
        modal.classList.add("hidden");
        resetForm();
    });

    function resetForm() {
        document.getElementById("taskName").value = "";
        document.getElementById("dueDate").value = "";
        document.getElementById("dueTime").value = "";
        document.getElementById("taskColor").value = "";
        document.getElementById("priority").value = "High";
        document.getElementById("recurring").checked = false;
    }

    //Display Tasks that Belong to the Selected Folder
    function updateTaskList(tasks) {
        taskList.innerHTML = "";
        const selectedFolder = folderSelect.value;
        const priorityOrder = {"High": 1, "Medium": 2, "High": 3};

        tasks
        .filter(task => task.folder === selectedFolder)
        .sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4))
        .forEach(task => addTaskToUI(task));
    }

    //Add a New Folder
    function addFolderToUI(folder) {
        const option = document.createElement("option");
        option.value = folder;
        option.textContent = folder;
        folderSelect.appendChild(option);
    }

    //Add a Task to the List in the UI
    function addTaskToUI(task) {
        const taskItem = document.createElement("li");

        //Create and Append Task Name
        const strongElem = document.createElement("strong");
        strongElem.textContent = task.name;
        strongElem.classList.add(`priority-${task.priority.toLowerCase()}`);
        if (task.completed) {
            strongElem.style.textDecoration = "line-through";
            strongElem.style.color = "grey";
        }
        taskItem.appendChild(strongElem);
        taskItem.appendChild(document.createElement("br"));

        //Append Due Date as Text
        const dueText = document.createTextNode("Due: " + new Date(task.dueDate).toLocaleString());
        taskItem.appendChild(dueText);
        
        taskItem.style.color = task.color;

        //Create Buttons Container
        const buttonsDiv = document.createElement("div");
        buttonsDiv.classList.add("task-buttons");

        //Edit Button
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.onclick = () => editTask(task, taskItem);

        //Mark as Complete Button
        const completeButton = document.createElement("button");
        completeButton.textContent = task.completed ? "Undo Complete" : "Mark Complete";
        completeButton.onclick = () => toggleComplete(task, taskItem);

        //Delete Button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.onclick = () => deleteTask(task, taskItem);

        buttonsDiv.appendChild(editButton);
        buttonsDiv.appendChild(completeButton);
        buttonsDiv.appendChild(deleteButton);
        taskItem.appendChild(buttonsDiv);
        taskList.appendChild(taskItem);
    }

    //Edit Existing Task
    function editTask(task, taskItem) {
        const editOptions = prompt("What Would You Like to Edit? (name, due date, color):");
        if (!editOptions) return;
        let newTaskName = task.name;
        let newDueDate = task.dueDate;
        let newColor = task.color;

        if (editOptions.includes("name")) {
            newTaskName = prompt("Enter New Task Name:", task.name) || task.name;
        }
        if (editOptions.includes("due date")) {
            const newDateInput = prompt("Enter New Due Date:", new Date(task.dueDate).toISOString().slice(0, 16));
            const parsedDate = new Date(newDateInput);

            if (!isNaN(parsedDate.getTime())) {
                newDueDate = parsedDate.toISOString();
            } else {
                alert("Invalid Date Format.");
            }
        }
        if  (editOptions.includes("color")) {
            newColor = prompt("Enter New Task Color:", task.color) || task.color;
        }

        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks || [];
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

    //Toggle a Task's Completed State
    function toggleComplete(task, taskItem) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks || [];
            const index = tasks.findIndex(t => t.id === task.id);

            if (index > -1) {
                tasks[index].completed = !tasks[index].completed;
                chrome.storage.sync.set({tasks}, () => updateTaskList(tasks));
            }
        });
    }

    //Delete Task
    function deleteTask(task, taskItem) {
        chrome.storage.sync.get(["tasks"], (data) => {
            let tasks = data.tasks.filter(t => t.id !== task.id);
            chrome.storage.sync.set({tasks}, () => {
                chrome.alarms.clear(task.id);
                taskItem.remove();
            });
        });
    }

    //Schedule a Chrome Alarm Notification
    async function scheduleNotification(task) {
        const parsedDate = new Date(task.dueDate);
        if (isNaN(parsedDate.getTime())) {
            console.error("Invalid Due Date");
            return;
        }

        const dueTime = parsedDate.getTime();
        const now = Date.now();
        const timeUntilDue = dueTime - now;
        if (timeUntilDue > 0) {
            if (task.recurring) {
                chrome.alarms.create(task.id, {when: dueTime, periodInMinutes: 1440});
            } else {
                chrome.alarms.create(task.id, {when: dueTime});
            }
        }
    }

    //OCR Task Button
    document.getElementById("ocrTask").addEventListener("click", () => {
        const fileInput = document.getElementById("imageUpload");
        if (fileInput.files.length === 0) {
            alert("Please Upload an Image.");
            return;
        }
        const folder = prompt("Enter Folder Name (Optional):") || "Default";
        performOCRandCreateTask(fileInput.files[0], folder);
    })

    //Perform OCR and Create Task using Cloud Vision API
    async function performOCRandCreateTask(imageFile, folder) {
        const loadingIndicator = document.getElementById("loading");
        const preview = document.getElementById("imagePreview");

        loadingIndicator.textContent = "Processing Image ... This May Take a Few Seconds";
        loadingIndicator.classList.remove("hidden");

        try {
            const reader = new FileReader();
            reader.onload = async function (e) {
                const base64Image = e.target.result.split(",")[1];
                const requestBody = {
                    requests: [{
                            image: {content: base64Image},
                            features: [{type: "DOCUMENT_TEXT_DETECTION", maxResults: 1}],
                            imageContext: {languageHints: ["en"]}
                        }]
                };

                const apiKey = "AIzaSyCBfJd37RWxSoGqP59unB9pmXu0T2-INnw";
                const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(requestBody)
                });

                const result = await response.json();
                if (result.error) {
                    console.error("Cloud Vision API Error:", result.error);
                    throw new Error(result.error.message);
                }

                const annotation = result.responses[0].fullTextAnnotation;
                const ocrText = annotation ? annotation.text : "Untitled Task";
                const lines = ocrText.split("\n").map(line => line.trim()).filter(line => line !== "");

                const taskName = lines[0] || "Untitled Task";
                let dueDate = "";
                if (lines[1]) {
                    const parts = lines[1].split("/");
                    if (parts.length === 3) {
                        dueDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                    }
                }
                const dueTime = lines[2] || [];
                const taskColor = lines[3] || "black";
                let priority = "High";
                if (lines[4] && ["High", "Medium", "Low"].includes(lines[4].trim())) {
                    priority = lines[4].trim();
                }
                let recurring = false;
                if (lines[5] && lines[5].toLowerCase().includes("recurring")) {
                    recurring = true;
                }

                document.getElementById("taskName").value = taskName;
                document.getElementById("dueDate").value = dueDate;
                document.getElementById("dueTime").value = dueTime;
                document.getElementById("taskColor").value = taskColor;
                document.getElementById("priority").value = priority;
                document.getElementById("recurring").checked = recurring;

                document.getElementById("modal").classList.remove("hidden");
                loadingIndicator.classList.add("hidden");
                alert("OCR Task Extracted.");
            };
            reader.readAsDataURL(imageFile);
        } catch (error) {
            loadingIndicator.classList.add("hidden");
            alert("An Error Occured During OCR");
            console.error("OCR Error:", error);
        }
    }
});
