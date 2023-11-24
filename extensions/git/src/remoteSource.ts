// imports locais
import {
    PickRemoteSourceOptions,
    PickRemoteSourceResult
} from './api/git-base';

import {
    GitBaseApi
} from './git-base';

// exports
export async function pickRemoteSource(options: PickRemoteSourceOptions & {
    branch?: false | undefined
}): Promise<String | undefined>;

export async function pickRemoteSource(options: PickRemoteSourceOptions & {
    branch: true
}): Promise<PickRemoteSourceResult | undefined>;

export async function pickRemoteSource(options: PickRemoteSourceOptions = {}): Promise<string | PickRemoteSourceResult | undefined> {
    return GitBaseApi.getAPI().pickRemoteSource(options);
}

export async function getRemoteSourceActions(url: string) {
    return GitBaseApi.getAPI().getRemoteSourceActions(url);
}
