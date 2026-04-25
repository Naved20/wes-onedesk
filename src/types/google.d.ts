// Type definitions for Google APIs
declare namespace gapi {
  namespace client {
    function init(config: {
      apiKey: string;
      discoveryDocs: string[];
    }): Promise<void>;

    function getToken(): { access_token: string } | null;

    namespace drive {
      namespace files {
        function list(params: {
          pageSize?: number;
          fields?: string;
          q?: string;
          orderBy?: string;
        }): Promise<{
          result: {
            files?: Array<{
              id: string;
              name: string;
              mimeType: string;
              size?: string;
              createdTime: string;
              modifiedTime: string;
              webViewLink?: string;
              webContentLink?: string;
              thumbnailLink?: string;
            }>;
          };
        }>;

        function create(params: {
          resource: {
            name: string;
            mimeType: string;
            parents?: string[];
          };
          fields?: string;
        }): Promise<{
          result: {
            id: string;
            name: string;
            mimeType: string;
            createdTime: string;
            modifiedTime: string;
          };
        }>;

        function get(params: {
          fileId: string;
          fields?: string;
        }): Promise<{
          result: {
            id: string;
            name: string;
            mimeType: string;
            size?: string;
            createdTime: string;
            modifiedTime: string;
            webViewLink?: string;
            webContentLink?: string;
            thumbnailLink?: string;
          };
        }>;

        const _delete: (params: { fileId: string }) => Promise<void>;
        export { _delete as delete };
      }
    }
  }

  function load(api: string, callback: () => void): void;
}

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      function initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: string | ((response: any) => void);
      }): {
        callback: (response: any) => void;
        requestAccessToken: () => void;
      };
    }
  }
}

declare const gapi: typeof gapi;
declare const google: typeof google;
