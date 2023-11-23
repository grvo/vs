declare module 'vs' {
    // https://github.com/microsoft/vscode/issues/180582

    export namespace workspace {
        /**
         * @param scheme - o scheme do uri que esse fornecedor pode fornecer uris canônicas
         * @param provider - o fornecedor que pode converter uris do scheme @param scheme para uma uri canônica que é estável entre as máquinas
         */
        export function registerCanonicalUriProvider(scheme: string, provider: CanonicalUriProvider): Disposable;

        /**
         * @param uri - a uri que fornece uma uri canônica
         * @param token - um token de cancelamento para a solicitação
         */
        export function getCanonicalUri(uri: Uri, options: CanonicalUriRequestOptions, token: CancellationToken): ProviderResult<Uri>;
    }

    export interface CanonicalUriProvider {
        /**
         * @param uri - a uri que fornece uma uri canônica
         * @param options - opções que o fornecedor deve honrar na uri que retorna
         * @param token - um token de cancelamento para a solicitação
         * 
         * @returns a uri canônica para a uri solicitada / ou undefined para nenhuma uri canônica tenha sido solicitada
         */
        provideCanonicalUri(uri: Uri, options: CanonicalUriRequestOptions, token: CancellationToken): ProviderResult<Uri>;
    }

    export interface CanonicalUriRequestOptions {
        /**
         * o scheme desejado da uri canônica
         */
        targetScheme: string;
    }
}
