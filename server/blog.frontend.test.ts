import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const source = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("blog section frontend wiring", () => {
  it("registers a public blog listing route, article route, and blog-aware metadata helpers", () => {
    const appSource = source("client/src/App.tsx");

    expect(appSource).toContain(
      'const Blog = lazy(() => import("./pages/Blog"));'
    );
    expect(appSource).toContain(
      '<Route path="/blog/:slug" component={Blog} />'
    );
    expect(appSource).toContain('<Route path="/blog" component={Blog} />');
    expect(appSource).toContain('"/blogs": "/blog"');
    expect(appSource).toContain('"/journal": "/blog"');
    expect(appSource).toContain('pathname.startsWith("/blog/")');
    expect(appSource).toContain("getBlogPostBySlug(blogSlug)");
  });

  it("adds blog entry points to public navigation, footer links, and the homepage content grid", () => {
    const homeSource = source("client/src/pages/Home.tsx");

    expect(homeSource).toContain('{ href: "/blog", label: "Blog" }');
    expect(homeSource).toContain('<Link href="/blog">Blog</Link>');
    expect(homeSource).toContain("Latest from the braid journal");
    expect(homeSource).toContain("Browse all posts");
    expect(homeSource).toContain("Read article");
  });

  it("removes the halo braids article while keeping blog page rendering support", () => {
    const blogPageSource = source("client/src/pages/Blog.tsx");
    const blogContentSource = source("client/src/lib/blogContent.ts");

    expect(blogContentSource).not.toContain('slug: "halo-braids-style-guide"');
    expect(blogContentSource).toContain('slug: "make-knotless-braids-last-longer"');
    expect(blogContentSource).toContain("galleryImages");
    expect(blogPageSource).toContain("Style gallery");
    expect(blogPageSource).toContain("sm:grid-cols-2 lg:grid-cols-3");
    expect(blogPageSource).toContain("Back to all articles");
    expect(blogPageSource).toContain("Latest from the Eby’s Place blog");
  });
});
