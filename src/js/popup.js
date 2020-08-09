import "../css/popup.css";
import {Fetcher} from './fetcher.js'
import { Settings } from "./settings";

document.getElementById("run").onclick = async () => {
    var dl = document.getElementById("DL").value;
    await Settings.Set("DL", dl);
    document.getElementById("error").innerHTML = "";

    let fetcher = new Fetcher();
    fetcher
        .run()
        .catch(error => {
            console.error(error);
            document.getElementById("error").innerHTML = "Error: " + error;
        });
    
};

// chrome.storage.sync.get(['PAT'], result => {
//     console.log("hi");
//     document.getElementById("pat").value = result.PAT;
// });

Settings.Get("DL")
    .then(dl => dl && (document.getElementById("DL").value = dl));

