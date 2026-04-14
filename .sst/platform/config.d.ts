import "./src/global.d.ts"
import "../types.generated"
import { AppInput, App, Config } from "./src/config"
import * as _aws from "@pulumi/aws";


declare global {
  // @ts-expect-error
  export import aws = _aws
  interface Providers {
    providers?: {
      "aws"?:  (_aws.ProviderArgs & { package?: string, version?: string }) | string;
    }
  }
  export const $config: (
    input: Omit<Config, "app"> & {
      app(input: AppInput): Promise<Omit<App, "providers"> & Providers> | (Omit<App, "providers"> & Providers);
    },
  ) => Config;
}
