import { useEffect, useState } from 'react';
import { fsApi } from '../api/fs';
import type { RecentProject } from '../types/fs';

interface RecentProjectsProps {
  onSelectProject: (path: string) => void;
}

export function RecentProjects({ onSelectProject }: RecentProjectsProps) {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fsApi
      .getRecentProjects()
      .then(setRecentProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleOpenProject = async (path: string) => {
    try {
      const info = await fsApi.openProject(path);
      await fsApi.addRecentProject(path);
      onSelectProject(path);
    } catch (e) {
      console.error('Failed to open project:', e);
    }
  };

  if (loading) return null;

  if (recentProjects.length === 0) return null;

  return (
    <div className="recent-projects">
      <h3 className="recent-projects-title">最近项目</h3>
      <ul className="recent-projects-list">
        {recentProjects.map((project) => (
          <li
            key={project.path}
            className="recent-project-item"
            onClick={() => handleOpenProject(project.path)}
          >
            <span className="recent-project-name">{project.name}</span>
            <span className="recent-project-path">{project.path}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
