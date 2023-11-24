'use strict';

// imports de dependências
import {
    workspace,

    Uri
} from 'vscode';

import {
    TextDecoder
} from 'util';

// import local
import {
    getExtensionContext
} from './main';

const emojiRegex = /:([-+_a-z0-9]+):/g;

let emojiMap: Record<string, string> | undefined;
let emojiMapPromise: Promise<void> | undefined;

export async function ensureEmojis() {
    if (emojiMap === undefined) {
        if (emojiMapPromise === undefined) {
            emojiMapPromise = loadEmojiMap();
        }

        await emojiMapPromise;
    }
}

async function loadEmojiMap() {
    const context = getExtensionContext();

    const uri = (Uri as any).joinPath(context.extensionUri, 'resources', 'emojis.json');

    emojiMap = JSON.parse(new TextDecoder('utf8').decode(await workspace.fs.readFile(uri)));
}

export function emojify(message: string) {
    if (emojiMap === undefined) {
        return message;
    }

    return message.replace(emojiRegex, (s, code) => {
        return emojiMap?.[code] || s;
    });
}
