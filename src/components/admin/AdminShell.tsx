// ---------------------------------------------------------------------------
// Admin – main shell that composes sidebar, header, and content area
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import PostList from "./PostList";
import PostEditor from "./PostEditor";
import AuthorEditor from "./AuthorEditor";
import AuthorList from "./AuthorList";
import IssueEditor from "./IssueEditor";
import IssueList from "./IssueList";
import CreateItemModal, { postFields, authorFields, issueFields } from "./CreateItemModal";
import { useUnsavedChanges } from "./useUnsavedChanges";
import type { AuthorSummary, IssueSummary } from "../../lib/admin/types";

type ModalTarget = "posts" | "authors" | "issues" | null;

export default function AdminShell() {
  const [activeCollection, setActiveCollection] = useState("posts");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Refresh counters — increment to trigger list re-fetch
  const [refreshPosts, setRefreshPosts] = useState(0);
  const [refreshAuthors, setRefreshAuthors] = useState(0);
  const [refreshIssues, setRefreshIssues] = useState(0);

  // Creation modal
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null);

  // Relation data (needed for post creation modal)
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [issues, setIssues] = useState<IssueSummary[]>([]);

  useEffect(() => {
    fetch("/api/admin/authors")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: AuthorSummary[]) => setAuthors(d))
      .catch(() => {});
    fetch("/api/admin/issues")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: IssueSummary[]) => setIssues(d))
      .catch(() => {});
  }, [refreshAuthors, refreshIssues]);

  const { setDirty, confirmNavigation } = useUnsavedChanges();

  // ---- Guarded navigation helpers ----

  const handleCollectionChange = useCallback(
    (c: string) => {
      if (c === activeCollection) return;
      if (!confirmNavigation()) return;
      setDirty(false);
      setActiveCollection(c);
      setSelectedSlug(null);
    },
    [activeCollection, confirmNavigation, setDirty],
  );

  const handleSlugSelect = useCallback(
    (slug: string) => {
      if (slug === selectedSlug) return;
      if (!confirmNavigation()) return;
      setDirty(false);
      setSelectedSlug(slug);
    },
    [selectedSlug, confirmNavigation, setDirty],
  );

  const handleDirtyChange = useCallback(
    (value: boolean) => setDirty(value),
    [setDirty],
  );

  // ---- Creation handlers ----

  const openCreateModal = useCallback(
    (target: ModalTarget) => {
      if (!confirmNavigation()) return;
      setDirty(false);
      setModalTarget(target);
    },
    [confirmNavigation, setDirty],
  );

  const handleCreated = useCallback(
    (slug: string) => {
      const target = modalTarget;
      setModalTarget(null);

      // Refresh the relevant list and auto-open the new item
      if (target === "posts") {
        setRefreshPosts((n) => n + 1);
        setActiveCollection("posts");
        setSelectedSlug(slug);
      } else if (target === "authors") {
        setRefreshAuthors((n) => n + 1);
        setActiveCollection("authors");
        setSelectedSlug(slug);
      } else if (target === "issues") {
        setRefreshIssues((n) => n + 1);
        setActiveCollection("issues");
        setSelectedSlug(slug);
      }
    },
    [modalTarget],
  );

  // ---- Delete / Duplicate handlers ----

  const handleDeleted = useCallback(
    (collection: "posts" | "authors" | "issues") => {
      setDirty(false);
      setSelectedSlug(null);
      if (collection === "posts") setRefreshPosts((n) => n + 1);
      else if (collection === "authors") setRefreshAuthors((n) => n + 1);
      else if (collection === "issues") setRefreshIssues((n) => n + 1);
    },
    [setDirty],
  );

  const handleDuplicated = useCallback(
    (collection: "posts" | "authors" | "issues", newSlug: string) => {
      setDirty(false);
      setSelectedSlug(newSlug);
      if (collection === "posts") setRefreshPosts((n) => n + 1);
      else if (collection === "authors") setRefreshAuthors((n) => n + 1);
      else if (collection === "issues") setRefreshIssues((n) => n + 1);
    },
    [setDirty],
  );

  return (
    <div className="h-screen flex flex-col bg-white text-stone-800 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeCollection={activeCollection}
          onCollectionChange={handleCollectionChange}
        />

        {/* Posts collection */}
        {activeCollection === "posts" && (
          <>
            <PostList
              selectedSlug={selectedSlug}
              onSelect={handleSlugSelect}
              refreshKey={refreshPosts}
              onNew={() => openCreateModal("posts")}
              authors={authors}
              issues={issues}
            />

            {selectedSlug ? (
              <PostEditor
                key={selectedSlug}
                slug={selectedSlug}
                onDirtyChange={handleDirtyChange}
                onDelete={() => handleDeleted("posts")}
                onDuplicate={(s) => handleDuplicated("posts", s)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-stone-300">
                Select a post to edit
              </div>
            )}
          </>
        )}

        {/* Authors collection */}
        {activeCollection === "authors" && (
          <>
            <AuthorList
              selectedSlug={selectedSlug}
              onSelect={handleSlugSelect}
              refreshKey={refreshAuthors}
              onNew={() => openCreateModal("authors")}
            />

            {selectedSlug ? (
              <AuthorEditor
                key={selectedSlug}
                slug={selectedSlug}
                onDirtyChange={handleDirtyChange}
                onDelete={() => handleDeleted("authors")}
                onDuplicate={(s) => handleDuplicated("authors", s)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-stone-300">
                Select an author to edit
              </div>
            )}
          </>
        )}

        {/* Issues collection */}
        {activeCollection === "issues" && (
          <>
            <IssueList
              selectedSlug={selectedSlug}
              onSelect={handleSlugSelect}
              refreshKey={refreshIssues}
              onNew={() => openCreateModal("issues")}
            />

            {selectedSlug ? (
              <IssueEditor
                key={selectedSlug}
                slug={selectedSlug}
                onDirtyChange={handleDirtyChange}
                onDelete={() => handleDeleted("issues")}
                onDuplicate={(s) => handleDuplicated("issues", s)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-stone-300">
                Select an issue to edit
              </div>
            )}
          </>
        )}
      </div>

      {/* Creation modals */}
      {modalTarget === "posts" && (
        <CreateItemModal
          title="New Post"
          fields={postFields(authors, issues)}
          endpoint="/api/admin/posts/create"
          onCreate={handleCreated}
          onCancel={() => setModalTarget(null)}
        />
      )}
      {modalTarget === "authors" && (
        <CreateItemModal
          title="New Author"
          fields={authorFields()}
          endpoint="/api/admin/authors/create"
          onCreate={handleCreated}
          onCancel={() => setModalTarget(null)}
        />
      )}
      {modalTarget === "issues" && (
        <CreateItemModal
          title="New Issue"
          fields={issueFields()}
          endpoint="/api/admin/issues/create"
          onCreate={handleCreated}
          onCancel={() => setModalTarget(null)}
        />
      )}
    </div>
  );
}
