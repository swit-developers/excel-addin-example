/* eslint-disable no-undef */
/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global console, document, Excel, Office */

import { openDialog } from "./oauth-dialog";

Office.onReady(async (info) => {
  if (info.host === Office.HostType.Excel) {
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("signin").onclick = openDialog;
    document.getElementById("signout").onclick = signout;
    document.getElementById("make-template").onclick = makeTemplate;
    document.getElementById("import").onclick = importTasks;

    // Check if template has been created
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getRangeByIndexes(0, 0, 1, taskProperties.length);
      range.load("values");
      await context.sync();
      // Check if range.values[0] equals taskProperties
      if (
        range.values[0].every((value, index) => value === taskProperties[index])
      ) {
        await signedIn();
      } else {
        switchScreen("make-template-section");
      }
    });
  }
});

function switchScreen(screenId: string) {
  document.querySelectorAll("main").forEach((screen) => {
    if (screen.id == screenId) {
      screen.style.display = null;
    } else {
      screen.style.display = "none";
    }
  });
}

async function signout() {
  const res = await fetch("/api/signout", {
    method: "POST",
  });
  if (res.ok) {
    switchScreen("signin-section");
  }
}

export async function signedIn() {
  const res = await fetch("/api/user");
  if (res.ok) {
    const data = await res.json();
    document.getElementById(
      "user-info"
    ).innerHTML = `You're signed in as <b>${data.name}</b>.`;
    await listItems();
    switchScreen("select-destination");
  } else {
    switchScreen("signin-section");
  }
}

async function listItems(resourceType: "workspace" | "project" = "workspace") {
  const res = await fetch(
    resourceType === "workspace"
      ? `/api/workspaces`
      : `/api/projects?workspace_id=${
          (document.getElementById("workspace-selector") as HTMLSelectElement)
            .value
        }`
  );
  if (!res.ok) {
    // If not signed in, show the sign in screen.
    switchScreen("signin-section");
    return;
  }
  const data = await res.json();
  const selectorElement = document.getElementById(resourceType + "-selector");
  selectorElement.innerHTML = data.items
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");
  if (selectorElement.childElementCount) {
    document.getElementById("import").removeAttribute("disabled");
  } else {
    selectorElement.innerHTML = `<option value="" disabled>No ${resourceType}s</option>`;
    document.getElementById("import").setAttribute("disabled", "true");
  }
  if (resourceType === "workspace") {
    await listItems("project");
  }
}
document.getElementById("workspace-selector").onchange = () => {
  listItems("project");
};

const taskProperties = [
  "title",
  "content",
  "step",
  "assign",
  "bucket_id",
  "color",
  "priority",
  "start_date",
  "end_date",
];
// Define a typescript logger
async function makeTemplate() {
  try {
    await Excel.run(async (context) => {
      // Insert a new row before the first row.
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      sheet.getRange("1:1").insert(Excel.InsertShiftDirection.down);
      // Add column headers.
      const range = sheet.getRangeByIndexes(0, 0, 1, taskProperties.length);
      range.values = [taskProperties];
      range.format.autofitRows();
      await context.sync();
    });
    await signedIn();
  } catch (error) {
    console.error(error);
  }
}

async function importTasks() {
  try {
    if (document.getElementById("import").hasAttribute("disabled")) return;
    await Excel.run(async (context) => {
      const project_id = (
        document.getElementById("project-selector") as HTMLSelectElement
      ).value;
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getUsedRange();
      range.load("values");
      await context.sync();
      range.values.forEach(async (taskRecord, rowNum) => {
        if (rowNum === 0) return;
        const taskObject = {
          project_id: project_id,
        };
        taskProperties.forEach((property, index) => {
          if (typeof taskRecord[index] === "number") {
            // Convert dates to ISO strings.
            taskRecord[index] = new Date(
              (taskRecord[index] - 25569) * 86400 * 1000
            )
              .toISOString()
              .split("T")[0];
          }
          if (taskRecord[index]) taskObject[property] = taskRecord[index];
        });
        const res = await fetch(`/api/tasks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskObject),
        });
        var message;
        if (res.ok) {
          message = "Successful";
        } else {
          let result = await res.json();
          message = JSON.stringify(result.error);
          console.log(result);
        }
        sheet.getCell(rowNum, taskProperties.length).values = [[message]];
        await context.sync();
      });
    });
  } catch (error) {
    console.error(error);
  }
}
