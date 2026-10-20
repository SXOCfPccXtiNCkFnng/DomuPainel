'use client';

import { useEffect, useState } from 'react';
import { getSegmentFromStorage } from '@/lib/segmentConfig';
import { SCHEDULING_COPY, schedulingVerticalOf, type SchedulingCopy, type SchedulingVertical } from '@/lib/schedulingVerticals';

/**
 * Vocabulário do ramo de agenda da conta (lava rápido ou saúde e beleza).
 * Lido depois de montar: o ramo fica no navegador e a página é pré-renderizada.
 */
export function useSchedulingCopy(): { vertical: SchedulingVertical; copy: SchedulingCopy } {
  const [vertical, setVertical] = useState<SchedulingVertical>('automotivo');
  useEffect(() => {
    setVertical(schedulingVerticalOf(getSegmentFromStorage()) || 'automotivo');
  }, []);
  return { vertical, copy: SCHEDULING_COPY[vertical] };
}
