export class Settings {
    static Get(key) {
        return new Promise(resolve => chrome.storage.sync.get([key], resolve))
            .then(res => res[key]);
    }
    static Set(key, value) {
        return new Promise(resolve => chrome.storage.sync.set({[key]: value}, resolve));
    }
}