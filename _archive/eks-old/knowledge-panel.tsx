"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Article {
  id: string; slug: string; title: string; excerpt: string | null;
  category: string; tags: string[]; status: string;
  viewsCount: number; helpfulCount: number; publishedAt: string | null;
}

const CATEGORIES = ["GENERAL", "SAFETY", "CHEMICAL", "EQUIPMENT", "HR", "FAQ", "RUNBOOK"];

export function KnowledgePanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [metrics, setMetrics] = useState<{ total: number; published: number; drafts: number; totalViews: number } | null>(null);
  const { toast } = useToast();

  async function load() {
    try {
      const [list, m] = await Promise.all([
        api<{ items: Article[] }>(`/api/knowledge-base/articles${category ? `?category=${category}` : ""}`),
        api<{ total: number; published: number; drafts: number; totalViews: number }>("/api/knowledge-base/metrics"),
      ]);
      setArticles(list.items);
      setMetrics(m);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => { load(); }, [category]);

  async function doSearch() {
    if (!search.trim()) { load(); return; }
    try {
      const r = await api<{ items: Article[] }>(`/api/knowledge-base/search?q=${encodeURIComponent(search)}`);
      setArticles(r.items);
    } catch (e) {
      toast({ title: "Search failed", variant: "destructive" });
    }
  }

  const filtered = articles;

  return (
    <div className="space-y-3">
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Articles</div><div className="text-2xl font-bold">{metrics.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Published</div><div className="text-2xl font-bold text-green-600">{metrics.published}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Drafts</div><div className="text-2xl font-bold text-amber-600">{metrics.drafts}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Views</div><div className="text-2xl font-bold">{metrics.totalViews}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Search articles..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <Button onClick={doSearch}>Search</Button>
            <Button variant="outline" onClick={load}>Clear</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={category === "" ? "default" : "outline"} onClick={() => setCategory("")}>All</Button>
            {CATEGORIES.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>{c}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.excerpt ?? "No excerpt"}</div>
                </div>
                <Badge variant={a.status === "PUBLISHED" ? "default" : "secondary"} className="text-xs ml-2">{a.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">{a.category}</Badge>
                {a.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>👁 {a.viewsCount} views</span>
                <span>👍 {a.helpfulCount}</span>
                {a.publishedAt && <span>{new Date(a.publishedAt).toLocaleDateString()}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No articles found.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
