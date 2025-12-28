import { z } from "zod";
import { BuiltInVariableSchema } from "./BuiltInVariableSchema";
import { ClientSchema } from "./ClientSchema";
import { ContainerSchema } from "./ContainerSchema";
import { CustomTemplateSchema } from "./CustomTemplateSchema";
import { FolderSchema } from "./FolderSchema";
import { GtagConfigSchema } from "./GtagConfigSchema";
import { TagSchema } from "./TagSchema";
import { TransformationSchema } from "./TransformationSchema";
import { TriggerSchema } from "./TriggerSchema";
import { VariableSchema } from "./VariableSchema";
import { ZoneSchema } from "./ZoneSchema";

export const ContainerVersionSchema = z.object({
  accountId: z.string().optional().describe("GTM Account ID."),
  containerId: z.string().optional().describe("GTM Container ID."),
  containerVersionId: z
    .string()
    .optional()
    .describe(
      "The Container Version ID uniquely identifies the GTM Container Version.",
    ),
  name: z.string().optional().describe("Container version display name."),
  deleted: z
    .boolean()
    .optional()
    .describe(
      "A value of true indicates this container version has been deleted.",
    ),
  description: z.string().optional().describe("Container version description."),
  container: ContainerSchema.optional().describe(
    "The container that this version was taken from.",
  ),
  tag: z
    .array(TagSchema)
    .optional()
    .describe("The tags in the container that this version was taken from."),
  trigger: z
    .array(TriggerSchema)
    .optional()
    .describe(
      "The triggers in the container that this version was taken from.",
    ),
  variable: z
    .array(VariableSchema)
    .optional()
    .describe(
      "The variables in the container that this version was taken from.",
    ),
  folder: z
    .array(FolderSchema)
    .optional()
    .describe("The folders in the container that this version was taken from."),
  builtInVariable: z
    .array(BuiltInVariableSchema)
    .optional()
    .describe(
      "The built-in variables in the container that this version was taken from.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  zone: z
    .array(ZoneSchema)
    .optional()
    .describe("The zones in the container that this version was taken from."),
  customTemplate: z
    .array(CustomTemplateSchema)
    .optional()
    .describe(
      "The custom templates in the container that this version was taken from.",
    ),
  client: z
    .array(ClientSchema)
    .optional()
    .describe("The clients in the container that this version was taken from."),
  gtagConfig: z
    .array(GtagConfigSchema)
    .optional()
    .describe(
      "The Google tag configs in the container that this version was taken from.",
    ),
  transformation: z
    .array(TransformationSchema)
    .optional()
    .describe(
      "The transformations in the container that this version was taken from.",
    ),
});
