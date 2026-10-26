import React from 'react';
import { Panel } from './UIComponents';

type GetStr = (key: string, fallback?: string) => string;

interface FrameMetricsWidgetProps {
  getStr: GetStr;
}

/**
 * 前台应用帧指标小卡片:帧时间 / GPU忙时 / GPU延迟 / CPU忙时。
 *
 * 数据来自 sidecar 的 PresentMon 桥(键 SFRAMETIME/SGPUBUSY/SGPULATENCY/SCPUBUSY),
 * 数值单位都是 ms;前台无呈现活动或 PresentMon 未运行时 sidecar 回落 "0",
 * 这里把 0 显示成 "--" 区分"没数据"和"真的测出 0ms"。
 *
 * 布局按需求刻意做成**两行**:第一行名称、第二行数值,不做成四列两行
 * (名称+数值成对)—— 窄面板(280px)里 8 个单元格排不下。
 */
export const FrameMetricsWidget: React.FC<FrameMetricsWidgetProps> = ({ getStr }) => {
  const raw = {
    frametime: getStr('SFRAMETIME', '0'),
    gpubusy: getStr('SGPUBUSY', '0'),
    gpulatency: getStr('SGPULATENCY', '0'),
    cpubusy: getStr('SCPUBUSY', '0'),
  };

  const fmt = (v: string) => (v === '0' ? '--' : v);

  return (
    <Panel className="!mb-0">
      <div className="grid grid-cols-4 font-mono leading-tight">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-80">
            FrameTime
          </span>
          <span className="font-digital text-[13px] text-[var(--chart-fps)]">
            {fmt(raw.frametime)}
            <span className="text-[9px] opacity-60 ml-0.5">ms</span>
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-80">
            GPU Busy
          </span>
          <span className="font-digital text-[13px] text-[var(--chart-gpu)]">
            {fmt(raw.gpubusy)}
            <span className="text-[9px] opacity-60 ml-0.5">ms</span>
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-80">
            GPU Lat
          </span>
          <span className="font-digital text-[13px] text-[var(--chart-gpu)]">
            {fmt(raw.gpulatency)}
            <span className="text-[9px] opacity-60 ml-0.5">ms</span>
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-80">
            CPU Busy
          </span>
          <span className="font-digital text-[13px] text-[var(--chart-cpu)]">
            {fmt(raw.cpubusy)}
            <span className="text-[9px] opacity-60 ml-0.5">ms</span>
          </span>
        </div>
      </div>
    </Panel>
  );
};
