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
    bio: z.string(),
    birthYear: z.string(),
    birthPlace: z.string(),
    photo: z.string().optional(),
    social: z
      .object({
        website: z.string().url().optional(),
        instagram: z.string().url().optional(),
        x: z.string().url().optional(),
      })
      .optional(),
  }),
});

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(), // usually inferred from filename; optional
    date: z.date(),
    category: categoryEnum,
    author: reference("authors"),
    issue: reference("issues").optional(),
    excerpt: z.string(),
    featuredImage: z.string().optional(),
  }),
});

export const collections = { posts, authors, issues };