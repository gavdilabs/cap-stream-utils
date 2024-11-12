import { Readable } from "stream";

/**
 * Utility deconstruction type for unknown object mappings
 */
export type UnknownObjectMap = {
  [key: string]: unknown;
};

/**
 * Service binding object for CDS "requires" section in package.json
 */
export type ExternalServiceConfig = {
  kind: "odata" | "odatav4" | "odatav2" | "rest";
  model?: string;
  credentials?: {
    // Local specific
    url?: string;
    authentication?: string;
    username?: string;
    password?: string;
    // Remote specific
    forwardAuthToken?: boolean;
    destination?: string;
  };
};

/**
 * Custom media streaming return body supported by SAP.
 * For more info see:
 * https://cap.cloud.sap/docs/node.js/best-practices#custom-streaming-beta
 */
export type MediaReadResult = {
  value: Readable;
  $mediaContentType: string;
  $mediaContentDispositionFilename?: string;
  $mediaContentDispositionType?: string;
};
