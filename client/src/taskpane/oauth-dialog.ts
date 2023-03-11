/* eslint-disable no-undef */
import { signedIn } from "./taskpane";
var dialog;
function dialogCallback(asyncResult) {
  if (asyncResult.status == "failed") {
    // In addition to general system errors, there are 3 specific errors for
    // displayDialogAsync that you can handle individually.
    switch (asyncResult.error.code) {
      case 12004:
        console.log("Domain is not trusted");
        break;
      case 12005:
        console.log("HTTPS is required");
        break;
      case 12007:
        console.log("A dialog is already opened.");
        break;
      default:
        console.log(asyncResult.error.message);
        break;
    }
  } else {
    dialog = asyncResult.value;
    /*Messages are sent by developers programatically from the dialog using office.context.ui.messageParent(...)*/
    dialog.addEventHandler(
      Office.EventType.DialogMessageReceived,
      messageHandler
    );

    /*Events are sent by the platform in response to user actions or errors. For example, the dialog is closed via the 'x' button*/
    dialog.addEventHandler(Office.EventType.DialogEventReceived, eventHandler);
  }
}

function messageHandler(arg) {
  dialog.close();
  console.log(arg.message);
}

function eventHandler(arg) {
  // In addition to general system errors, there are 2 specific errors
  // and one event that you can handle individually.
  switch (arg.error) {
    case 12002:
      console.log("Cannot load URL, no such page or bad URL syntax.");
      break;
    case 12003:
      console.log("HTTPS is required.");
      break;
    case 12006:
      try {
        signedIn();
      } catch (e) {
        console.log(e.message);
      }
      break;
    default:
      console.log("Undefined error in dialog window");
      break;
  }
}

export function openDialog() {
  Office.context.ui.displayDialogAsync(
    location.origin + "/oauth-dialog.html?initiating=true",
    {
      height: 70,
      width: 50,
      promptBeforeOpen: false
    },
    dialogCallback
  );
}
