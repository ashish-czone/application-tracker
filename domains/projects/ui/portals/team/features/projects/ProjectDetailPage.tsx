import { Link, useParams } from 'react-router';
import {
  Button,
  EmptyState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@packages/ui';
import { ChevronLeft } from 'lucide-react';
import { useProjectSummary } from '../../../../hooks/useProjectsApi';
import { ProjectHeaderStrip } from './components/ProjectHeaderStrip';
import { ProjectOverview } from './components/ProjectOverview';
import { MilestonesAccordion } from './components/MilestonesAccordion';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, refetch } = useProjectSummary(id);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/projects">
          <ChevronLeft className="h-4 w-4 mr-1" />
          All projects
        </Link>
      </Button>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      )}

      {isError && (
        <EmptyState
          quote="We couldn't load this project."
          cta={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}

      {project && (
        <>
          <ProjectHeaderStrip project={project} />

          <Tabs defaultValue="milestones">
            <TabsList>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>
            <TabsContent value="milestones" className="mt-4">
              <MilestonesAccordion project={project} />
            </TabsContent>
            <TabsContent value="overview" className="mt-4">
              <ProjectOverview project={project} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
