import { getCollection, getEntry, type CollectionEntry } from "astro:content";

/** Lowercase + strip diacritics for accent-insensitive matching */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type PostWithAuthor = {
  post: CollectionEntry<"posts">;
  authorName: string;
  authorSlug: string;
};

export async function searchPosts(query: string): Promise<PostWithAuthor[]> {
  const q = normalizeText(query.trim());
  if (!q) return [];

  const allPosts = await getCollection(
    "posts",
    (p) => (p.data.status ?? "published") === "published",
  );

  // Resolve all authors in parallel so we can match against author names too
  const postsWithAuthors = await Promise.all(
    allPosts.map(async (post) => {
      const author = await getEntry(post.data.author);
      return { post, author };
    }),
  );

  const matched = postsWithAuthors.filter(({ post, author }) => {
    const searchable = [
      post.data.title,
      post.data.excerpt ?? "",
      post.data.category,
      author?.data.name ?? "",
      post.body ?? "",
    ]
      .map(normalizeText)
      .join(" ");
    return searchable.includes(q);
  });

  // Sort newest first
  matched.sort(
    (a, b) => b.post.data.date.valueOf() - a.post.data.date.valueOf(),
  );

  return matched.map(({ post, author }) => ({
    post,
    authorName: author?.data.name ?? "",
    authorSlug: author?.slug ?? "",
  }));
}
