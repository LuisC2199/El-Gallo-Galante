import { defineCollection, reference, z } from "astro:content";

const categoryEnum = z.enum(["Poesia", "Narrativa", "Critica", "Ensayo", "Epistolario"]);

const issues = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    number: z.string().optional(), // e.g. "No. 12" or "Vol. 2"
    coverImage: z.string().optional(),
    description: z.string().optional(),
    featuredPostSlugs: z.array(z.string()).optional(), // optional curated list
  }),
});

const authors = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string(),
    birthYear: z.string(),
    birthPlace: z.string(),
    photo: z.string().optional(),
    gender: z.boolean().optional(), // true = male, false = female
    social: z
      .object({
        website: z.string().optional(),
        instagram: z.string().optional(),
        x: z.string().optional(),
        facebook: z.string().optional(),
        tiktok: z.string().optional(),
      })
      .optional(),
  }),
});

const postStatus = z.enum(["draft", "review", "published"]).default("published");

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    category: z.enum(["Poesía", "Narrativa", "Crítica", "Ensayo", "Epistolario"]),
    status: postStatus,
    issue: z.string(),
    author: reference("authors"),
    traductor: reference("authors").optional(),
    excerpt: z.string().optional(),
    presentacion: z
      .object({
        dropCapMode: z.enum(["auto", "none", "manual"]).default("auto"),
        dedicatoria: z.string().optional(),
        epigrafe: z.string().optional(),
        epigrafeAutor: z.string().optional(),
        metaEpistolar: z.string().optional(),
        firma: z.string().optional(),
      })
      .default({}),
    coverImage: z.string().optional(),
    featuredImage: z.string().optional(),
    imagePosition: z.enum(["top", "center", "bottom"]).optional(),
  }),
});

const preamble = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { posts, authors, issues, preamble };