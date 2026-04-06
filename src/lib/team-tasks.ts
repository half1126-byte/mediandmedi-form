import { SERVICES } from '@/data/services';
import { createTaskRecord } from './notion';

interface ServiceSelection {
  serviceId: string;
  quantity?: number;
}

interface TaskResult {
  team: string;
  taskName: string;
  success: boolean;
  error?: string;
}

export async function generateTeamTasks(
  clinicName: string,
  services: ServiceSelection[],
  parentId: string
): Promise<TaskResult[]> {
  const results: TaskResult[] = [];

  for (const selection of services) {
    const service = SERVICES.find((s) => s.id === selection.serviceId);
    if (!service) continue;

    const quantityStr = selection.quantity
      ? ` ${selection.quantity}${service.unit}`
      : '';
    const title = `신규: ${clinicName} - ${service.name}${quantityStr}`;
    const detail = `거래처: ${clinicName}\n서비스: ${service.name}${quantityStr}\n상태: 신규개원\n자동 생성됨`;

    const result = await createTaskRecord({
      title,
      team: service.team,
      clinicName,
      detail,
      parentId,
    });

    results.push({
      team: service.team,
      taskName: title,
      success: result.success,
      error: result.error,
    });
  }

  return results;
}
