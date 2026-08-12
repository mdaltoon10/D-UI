import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

import { HttpUtil, RandomUtil } from '@/utils';
import type { RealityScanResult } from '@/generated/types';
import {
  mergeUniqueSecurityValues,
  nonEmptyUniqueStrings,
  remoteCertificateTarget,
  resolvePreferredRealityValue,
} from '@/lib/xray/forms/security';

interface UseSubscriptionProfileSecurityActionsArgs {
  form: FormInstance;
  absoluteBase: (string | number)[];
  destination: string;
  profilePort: number;
  messageApi: MessageInstance;
}

export function useSubscriptionProfileSecurityActions({
  form,
  absoluteBase,
  destination,
  profilePort,
  messageApi,
}: UseSubscriptionProfileSecurityActionsArgs) {
  const { t } = useTranslation();
  const [securityBusy, setSecurityBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RealityScanResult | null>(null);

  const clientTlsPath = (...parts: (string | number)[]) => [
    ...absoluteBase,
    'tlsSettings',
    ...parts,
  ];
  const runtimeTlsPath = (...parts: (string | number)[]) => [
    ...absoluteBase,
    'runtime',
    'tlsSettings',
    ...parts,
  ];
  const clientRealityPath = (...parts: (string | number)[]) => [
    ...absoluteBase,
    'realitySettings',
    ...parts,
  ];
  const runtimeRealityPath = (...parts: (string | number)[]) => [
    ...absoluteBase,
    'runtime',
    'realitySettings',
    ...parts,
  ];

  const mergeClientPins = (hashes: unknown) => {
    const incoming = Array.isArray(hashes) ? hashes : [];
    const path = clientTlsPath('settings', 'pinnedPeerCertSha256');
    const current = form.getFieldValue(path) as string[] | undefined;
    form.setFieldValue(path, mergeUniqueSecurityValues(current, incoming));
  };

  const pinFromRemoteCertificate = async () => {
    const serverName = form.getFieldValue(clientTlsPath('serverName'));
    const target = remoteCertificateTarget(serverName, destination, profilePort);
    if (!target) {
      messageApi.warning(t('pages.inbounds.form.pinFromRemoteNoSni'));
      return;
    }

    setSecurityBusy(true);
    try {
      const response = await HttpUtil.post('/panel/api/server/getRemoteCertHash', {
        server: target,
      });
      if (!response?.success) {
        messageApi.warning(
          response?.msg || t('pages.inbounds.form.pinFromRemoteFailed'),
        );
        return;
      }
      mergeClientPins(response.obj);
    } finally {
      setSecurityBusy(false);
    }
  };

  const pinFromRuntimeCertificate = async () => {
    const certificates = form.getFieldValue(runtimeTlsPath('certificates')) as
      | Array<{ certificateFile?: string; certificate?: string[] }>
      | undefined;
    const first = certificates?.[0];
    const certFile = first?.certificateFile?.trim() ?? '';
    const certContent = Array.isArray(first?.certificate)
      ? first.certificate.join('\n').trim()
      : '';
    if (!certFile && !certContent) {
      messageApi.warning(t('pages.inbounds.setDefaultCertEmpty'));
      return;
    }

    setSecurityBusy(true);
    try {
      const response = await HttpUtil.post('/panel/api/server/getCertHash', {
        certFile,
        certContent,
      });
      if (!response?.success) {
        messageApi.warning(
          response?.msg || t('pages.inbounds.setDefaultCertEmpty'),
        );
        return;
      }
      mergeClientPins(response.obj);
    } finally {
      setSecurityBusy(false);
    }
  };

  const setRuntimeCertFromPanel = async (certificateIndex: number) => {
    setSecurityBusy(true);
    try {
      const response = await HttpUtil.post(
        '/panel/api/setting/all',
        undefined,
        { silent: true },
      );
      if (!response?.success) {
        messageApi.warning(
          response?.msg || t('pages.inbounds.setDefaultCertEmpty'),
        );
        return;
      }
      const obj = response.obj as {
        webCertFile?: string;
        webKeyFile?: string;
      };
      if (!obj?.webCertFile && !obj?.webKeyFile) {
        messageApi.warning(t('pages.inbounds.setDefaultCertEmpty'));
        return;
      }
      form.setFieldValue(
        runtimeTlsPath('certificates', certificateIndex, 'certificateFile'),
        obj.webCertFile ?? '',
      );
      form.setFieldValue(
        runtimeTlsPath('certificates', certificateIndex, 'keyFile'),
        obj.webKeyFile ?? '',
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const clearRuntimeCertFiles = (certificateIndex: number) => {
    form.setFieldValue(
      runtimeTlsPath('certificates', certificateIndex, 'certificateFile'),
      '',
    );
    form.setFieldValue(
      runtimeTlsPath('certificates', certificateIndex, 'keyFile'),
      '',
    );
  };

  const generateEch = async () => {
    const sni = form.getFieldValue(runtimeTlsPath('serverName'))
      || form.getFieldValue(clientTlsPath('serverName'))
      || '';
    setSecurityBusy(true);
    try {
      const response = await HttpUtil.post('/panel/api/server/getNewEchCert', {
        sni,
      });
      if (!response?.success) return;
      const obj = response.obj as {
        echServerKeys: string;
        echConfigList: string;
      };
      form.setFieldValue(runtimeTlsPath('echServerKeys'), obj.echServerKeys);
      form.setFieldValue(
        clientTlsPath('settings', 'echConfigList'),
        obj.echConfigList,
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const clearEch = () => {
    form.setFieldValue(runtimeTlsPath('echServerKeys'), '');
    form.setFieldValue(clientTlsPath('settings', 'echConfigList'), '');
  };

  const generateRealityKeypair = async () => {
    setSecurityBusy(true);
    try {
      const response = await HttpUtil.get('/panel/api/server/getNewX25519Cert');
      if (!response?.success) return;
      const obj = response.obj as {
        privateKey: string;
        publicKey: string;
      };
      form.setFieldValue(runtimeRealityPath('privateKey'), obj.privateKey);
      form.setFieldValue(
        clientRealityPath('settings', 'publicKey'),
        obj.publicKey,
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const clearRealityKeypair = () => {
    form.setFieldValue(runtimeRealityPath('privateKey'), '');
    form.setFieldValue(clientRealityPath('settings', 'publicKey'), '');
  };

  const generateMldsa65 = async () => {
    setSecurityBusy(true);
    try {
      const response = await HttpUtil.get('/panel/api/server/getNewmldsa65');
      if (!response?.success) return;
      const obj = response.obj as { seed: string; verify: string };
      form.setFieldValue(runtimeRealityPath('mldsa65Seed'), obj.seed);
      form.setFieldValue(
        clientRealityPath('settings', 'mldsa65Verify'),
        obj.verify,
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const clearMldsa65 = () => {
    form.setFieldValue(runtimeRealityPath('mldsa65Seed'), '');
    form.setFieldValue(clientRealityPath('settings', 'mldsa65Verify'), '');
  };

  const randomizeShortIds = () => {
    const shortIds = nonEmptyUniqueStrings(
      RandomUtil.randomShortIds().split(','),
    );
    form.setFieldValue(runtimeRealityPath('shortIds'), shortIds);
    form.setFieldValue(clientRealityPath('shortIds'), shortIds);
    form.setFieldValue(
      clientRealityPath('settings', 'shortId'),
      resolvePreferredRealityValue(shortIds, ''),
    );
  };

  const randomizeSpiderX = () => {
    form.setFieldValue(
      clientRealityPath('settings', 'spiderX'),
      `/${RandomUtil.randomSeq(15)}`,
    );
  };

  const applyRealityScanResult = (result: RealityScanResult) => {
    setScanResult(result);
    form.setFieldValue(runtimeRealityPath('target'), result.target);
    const serverNames = nonEmptyUniqueStrings(result.serverNames);
    if (serverNames.length === 0) return;
    form.setFieldValue(runtimeRealityPath('serverNames'), serverNames);
    form.setFieldValue(clientRealityPath('serverNames'), serverNames);
    form.setFieldValue(
      clientRealityPath('settings', 'serverName'),
      resolvePreferredRealityValue(serverNames, ''),
    );
  };

  const scanRealityTarget = async () => {
    const target = String(
      form.getFieldValue(runtimeRealityPath('target')) ?? '',
    ).trim();
    if (!target) {
      messageApi.warning(t('pages.inbounds.form.realityTargetRequired'));
      return;
    }

    setScanning(true);
    try {
      const response = await HttpUtil.post<RealityScanResult>(
        '/panel/api/server/scanRealityTarget',
        { target },
        { silent: true },
      );
      if (!response?.success || !response.obj) {
        setScanResult(null);
        messageApi.error(
          response?.msg
            || t('pages.inbounds.toasts.scanRealityTargetError'),
        );
        return;
      }
      applyRealityScanResult(response.obj);
      if (response.obj.feasible) {
        messageApi.success(
          t('pages.inbounds.toasts.scanRealityTargetFeasible'),
        );
      } else {
        messageApi.warning(
          response.obj.reason
            || t('pages.inbounds.toasts.scanRealityTargetNotFeasible'),
        );
      }
    } finally {
      setScanning(false);
    }
  };

  const scanRealityCandidates = async (
    targets?: string,
  ): Promise<RealityScanResult[]> => {
    const response = await HttpUtil.post<RealityScanResult[]>(
      '/panel/api/server/scanRealityTargets',
      targets ? { targets } : {},
      { silent: true },
    );
    if (!response?.success || !Array.isArray(response.obj)) {
      messageApi.error(
        response?.msg || t('pages.inbounds.toasts.scanRealityTargetError'),
      );
      return [];
    }
    return response.obj;
  };

  return {
    securityBusy,
    scanning,
    scanResult,
    pinFromRemoteCertificate,
    pinFromRuntimeCertificate,
    setRuntimeCertFromPanel,
    clearRuntimeCertFiles,
    generateEch,
    clearEch,
    generateRealityKeypair,
    clearRealityKeypair,
    generateMldsa65,
    clearMldsa65,
    randomizeShortIds,
    randomizeSpiderX,
    applyRealityScanResult,
    scanRealityTarget,
    scanRealityCandidates,
  };
}

export type SubscriptionProfileSecurityActions = ReturnType<
  typeof useSubscriptionProfileSecurityActions
>;
