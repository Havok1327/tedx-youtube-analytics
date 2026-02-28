"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  relatedThemes: string[];
  videoCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="py-10">
        <h1 className="text-3xl font-bold mb-4">Categories</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-2">No categories discovered yet.</p>
            <p className="text-sm text-muted-foreground">
              Run the pipeline to discover categories:{" "}
              <code className="bg-muted px-2 py-1 rounded text-xs">
                python scripts/tedx_pipeline.py run-all
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalVideos = categories.reduce((sum, c) => sum + c.videoCount, 0);

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground mt-1">
            {categories.length} categories across {totalVideos} video tags
          </p>
        </div>
        <Link
          href="/montage"
          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Montage Worksheets
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/categories/${cat.slug}`}>
            <Card className="h-full hover:border-red-300 hover:shadow-md transition-all cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{cat.name}</span>
                  <Badge variant="secondary">{cat.videoCount} videos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cat.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {cat.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {cat.relatedThemes.slice(0, 5).map((theme) => (
                    <Badge key={theme} variant="outline" className="text-xs">
                      {theme}
                    </Badge>
                  ))}
                  {cat.relatedThemes.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{cat.relatedThemes.length - 5}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
