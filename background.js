chrome.runtime.onInstalled.addListener(() => {
    console.log("Smart Task Manager Installed");
});

chrome.alarms.onAlarm.addListener((alarm) => {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Task Reminder",
        message: `Reminder: ${alarm.name}`
    });

    //Schedule Reminder for Every 24 Hours Until Task is Done
    chrome.storage.sync.get(["tasks"], (data) => {
        let tasks = data.tasks || [];
        const taskIndex = tasks.findIndex(t => t.name === alarm.name);
        if (taskIndex > -1 && !tasks[taskIndex].completed) {
            chrome.alarms.create(tasks[taskIndex].name, {when: Date.now() + 24 * 60 * 60 * 1000});
        }
    });
});
