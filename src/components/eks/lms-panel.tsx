"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

interface Course { id: string; code: string; title: string; category: string; difficulty: string; estimatedHours: number; _count: { lessons: number; enrollments: number }; }
interface Enrollment { id: string; status: string; finalScorePercent: number | null; enrolledAt: string; completedAt: string | null; course: { title: string; _count: { lessons: number } }; worker: { user: { fullName: string } }; }
interface Certification { id: string; certificateNumber: string; issuedAt: string; expiresAt: string | null; status: string; worker: { user: { fullName: string } }; course: { title: string }; }

export function LmsPanel() {
  const [tab, setTab] = useState<"courses" | "enrollments" | "certs">("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const { toast } = useToast();

  async function loadCourses() { try { const r = await api<{ items: Course[] }>("/api/lms/courses"); setCourses(r.items); } catch {} }
  async function loadEnrollments() { try { const r = await api<{ items: Enrollment[] }>("/api/lms/enrollments"); setEnrollments(r.items); } catch {} }
  async function loadCerts() { try { const r = await api<{ items: Certification[] }>("/api/lms/certifications"); setCerts(r.items); } catch {} }

  useEffect(() => {
    if (tab === "courses") loadCourses();
    if (tab === "enrollments") loadEnrollments();
    if (tab === "certs") loadCerts();
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["courses", "enrollments", "certs"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {tab === "courses" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{c.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.code}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{c.difficulty}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                  <div><div className="text-muted-foreground">Category</div><div className="font-medium">{c.category}</div></div>
                  <div><div className="text-muted-foreground">Hours</div><div className="font-medium">{c.estimatedHours}</div></div>
                  <div><div className="text-muted-foreground">Lessons</div><div className="font-medium">{c._count.lessons}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">{c._count.enrollments} enrolled</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "enrollments" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Worker Enrollments ({enrollments.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Worker</th>
                  <th className="text-left p-3">Course</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Score</th>
                  <th className="text-left p-3">Enrolled</th>
                </tr></thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">{e.worker.user.fullName}</td>
                      <td className="p-3">{e.course.title}</td>
                      <td className="p-3"><Badge variant={e.status === "COMPLETED" ? "default" : e.status === "IN_PROGRESS" ? "secondary" : "outline"} className="text-xs">{e.status.replace(/_/g, " ")}</Badge></td>
                      <td className="p-3 text-right">{e.finalScorePercent !== null ? `${e.finalScorePercent.toFixed(0)}%` : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(e.enrolledAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "certs" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Active Certifications ({certs.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="text-left p-3">Certificate #</th>
                  <th className="text-left p-3">Worker</th>
                  <th className="text-left p-3">Course</th>
                  <th className="text-left p-3">Issued</th>
                  <th className="text-left p-3">Expires</th>
                </tr></thead>
                <tbody>
                  {certs.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{c.certificateNumber}</td>
                      <td className="p-3">{c.worker.user.fullName}</td>
                      <td className="p-3">{c.course.title}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString()}</td>
                      <td className="p-3 text-xs text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
