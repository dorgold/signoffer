import { Settings } from "./settings";

export class Fetcher
{
    constructor(){
        this.baseUrl = "https://vsrm.dev.azure.com/microsoft/WDATP/_apis";
        this.baseUrl1 = "https://dev.azure.com/microsoft/WDATP/_apis";
    }

    async run () {
        var releaseId = await this.getReleaseId();
        var releaseUrl = `${this.baseUrl}/release/releases/${releaseId}?api-version=5.1`
        var release = await this.get(releaseUrl)
        console.log(release);

        var definitionId = release.releaseDefinition.id;
        var envId = release.environments.find(x => x.name.includes("PRD EUS")).definitionEnvironmentId;
        var buildId = this.getBuildIdFromRelease(release);
        var repo = this.getRepoFromRelease(release);
        console.log(buildId);

        var prevReleases = await this.get(`${this.baseUrl}/release/deployments?definitionId=${definitionId}&definitionEnvironmentId=${envId}&deploymentStatus=30&operationStatus=7960&%24top=1`)
        var prevRelease = prevReleases.value[0].release;
        console.log(prevRelease);

        var prevReleaseBuildId = this.getBuildIdFromRelease(prevRelease);
        console.log(prevReleaseBuildId);

        var commits = await this.get(`${this.baseUrl1}/build/changes?fromBuildId=${prevReleaseBuildId}&toBuildId=${buildId}&$top=100`);
        console.log(commits);
        
        var authors = commits.value.map(commit => commit.author);

        console.log(authors);

        var emails = await this.generateEmails(authors);
        console.log(emails);

        var updatedRelease = this.getUpdatedRelease(release, authors);
        await this.set(releaseUrl, updatedRelease);

        var owaUrl = await this.getOwaUrl(commits.value, emails, repo);
        console.log(owaUrl);
        chrome.tabs.create({ url:  owaUrl});
    }

    async get(url) {
        var pat = await this.getPat();
        console.log('PAT: ' + pat)
        var res = await fetch(url, {
            "headers": {
                //"Authorization": `Basic ${pat}`,
            },
        });

        if (res.status != 200) {
            throw 'wrong PAT';
        }

        return await res.json();
    }

    async set(url, value) {
        var pat = await this.getPat();
        console.log('PAT: ' + pat)
        var res = await fetch(url, {
            "method": "PUT",
            "headers": {
                "content-type": "application/json"
            },
            "body": JSON.stringify(value)
        });

        if (res.status != 200) {
            throw 'Problem updating description';
        }
    }

    getBuildIdFromRelease(release) {
        var artifact = release.artifacts.find(x => x.type == "Build");
        return artifact.definitionReference.version.id;
    }


    getRepoFromRelease(release) {
        var artifact = release.artifacts.find(x => x.type == "Build");
        return artifact.definitionReference.repository.name;
    }

    generateDescription(authors) {
        var names = [...new Set(authors.map(author => author.displayName))] // distinct
            .map(name => `${name}: `)
            .join('\n');

        return "Sign Offs - \n" + names;
    }

    getUpdatedRelease(release, authors) {
        var result = release;
        if (release.description.includes("Sign")) {
            throw 'Release already has signoffs';
        }
        var description = this.generateDescription(authors);
        console.log(description);

        result.description = description;

        if(!release.tags.find(x => x == "Production candidate")){
            result.tags = release.tags;
            result.tags.push("Production candidate");
        }

        return result;
    }

    async generateEmails(authors) {
        var emails = [...new Set(authors.map(author => author.uniqueName))]
            .join(';');

        var dl = await Settings.Get("DL");
        if (!!dl) emails += ";" + dl;
        
        emails += ';';

        return emails;
    }

    async getPat() {
        return new Promise(res => {
            chrome.storage.sync.get(['PAT'], res);
        })
        .then(result => result.PAT)
        .then(pat => btoa(":" + pat));
    }

    async getCurrentTabUrl() {
        return new Promise(res => {
            chrome.tabs.query({active: true, currentWindow: true}, res)
        })
        .then(tabs => {
            return tabs[0].url
        });
    }

    async getReleaseId() {
        var url = await this.getCurrentTabUrl();
        var matches = url.match(/releaseId=([^&]*)/);
        if (!matches || matches.length < 2) {
            throw 'Not a release page'; 
        }

        return matches[1];
    }

    async getOwaUrl(commits, emails, repo) {
        var releaseUrl = await this.getCurrentTabUrl();
        var subject = `Releasing ${repo} to production`;

        var commitsStr = commits
            .map(commit => `${commit.message} [${commit.author.displayName}]`)
            .join('\n');
        
        console.log(commitsStr)


        var body =
`Hi,

Please sign off the ${repo} release below:
${releaseUrl}

Commits:
${commitsStr}`;

        return `https://outlook.office.com/?path=/mail/action/compose&to=${emails}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
}