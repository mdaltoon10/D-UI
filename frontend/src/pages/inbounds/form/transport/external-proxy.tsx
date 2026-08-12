import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button, Form, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import {
  createSubscriptionProfileDraft,
  duplicateSubscriptionProfile,
  normalizeSubscriptionPort,
  planDefaultSubscriptionPortSync,
  type DefaultSubscriptionPortSyncState,
} from '@/lib/xray/subscription-profile';

import SubscriptionProfileEditor from './subscription-profile-editor';
import './external-proxy.css';


export default function ExternalProxyForm() {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const { control, setValue: setRHFValue } = useFormContext();
  const watchedParentPort = useWatch({ control, name: 'port' });
  const parentNetwork = (useWatch({ control, name: 'streamSettings.network' }) ?? 'tcp') as string;
  const parentSecurity = (useWatch({ control, name: 'streamSettings.security' }) ?? 'none') as string;
  const watchedProfiles = Form.useWatch(
    ['streamSettings', 'externalProxy'],
    form,
  ) as Array<{ port?: unknown }> | undefined;
  const profilesEnabled = Array.isArray(watchedProfiles) && watchedProfiles.length > 0;
  const watchedDefaultProfilePort = Form.useWatch(
    ['streamSettings', 'externalProxy', 0, 'port'],
    { form, preserve: true },
  );
  const portSyncStateRef = useRef<DefaultSubscriptionPortSyncState | null>(null);

  useEffect(() => {
    if (!profilesEnabled) {
      portSyncStateRef.current = null;
      return;
    }

    const current = {
      inboundPort: normalizeSubscriptionPort(watchedParentPort),
      profilePort: normalizeSubscriptionPort(watchedDefaultProfilePort),
    };
    const plan = planDefaultSubscriptionPortSync(
      portSyncStateRef.current,
      current,
    );

    portSyncStateRef.current = plan.state;

    if (
      plan.setInboundPort !== undefined
      && plan.setInboundPort !== current.inboundPort
    ) {
      form.setFieldValue('port', plan.setInboundPort);
      setRHFValue(
        'port',
        plan.setInboundPort,
        { shouldDirty: true },
      );
    }

    if (
      plan.setProfilePort !== undefined
      && plan.setProfilePort !== current.profilePort
    ) {
      form.setFieldValue(
        ['streamSettings', 'externalProxy', 0, 'port'],
        plan.setProfilePort,
      );
      setRHFValue(
        'streamSettings.externalProxy.0.port',
        plan.setProfilePort,
        { shouldDirty: true },
      );
    }
  }, [
    form,
    setRHFValue,
    watchedDefaultProfilePort,
    watchedParentPort,
    profilesEnabled,
  ]);

  const toggleProfiles = (on: boolean) => {
    const parentPort = normalizeSubscriptionPort(watchedParentPort);
    const profiles = on
      ? [createSubscriptionProfileDraft(parentPort ?? undefined)]
      : [];

    form.setFieldValue(
      ['streamSettings', 'externalProxy'],
      profiles,
    );

    setRHFValue(
      'streamSettings.externalProxy',
      profiles,
      {
        shouldDirty: true,
        shouldTouch: true,
      },
    );
  };

  return (
    <Form.Item
      noStyle
      shouldUpdate={(prev, curr) => {
        const a = (prev.streamSettings as { externalProxy?: unknown[] } | undefined)?.externalProxy;
        const b = (curr.streamSettings as { externalProxy?: unknown[] } | undefined)?.externalProxy;
        return (Array.isArray(a) ? a.length : 0) !== (Array.isArray(b) ? b.length : 0);
      }}
    >
      {({ getFieldValue }) => {
        const profiles = getFieldValue(['streamSettings', 'externalProxy']);
        const enabled = Array.isArray(profiles) && profiles.length > 0;

        return (
          <>
            <Form.Item
              label={t('pages.inbounds.form.subscriptionProfiles')}
              extra={t('pages.inbounds.form.subscriptionProfilesHint')}
            >
              <Switch checked={enabled} onChange={toggleProfiles} />
            </Form.Item>

            {enabled && (
              <Form.Item wrapperCol={{ span: 24 }}>
                <Form.List name={['streamSettings', 'externalProxy']}>
                  {(fields, { add, remove, move }) => (
                    <>
                      <div className="ext-proxy-list">
                        {fields.map((field, index) => (
                          <SubscriptionProfileEditor
                            key={field.key}
                            fieldName={field.name}
                            displayIndex={index + 1}
                            totalProfiles={fields.length}
                            form={form}
                            parentNetwork={parentNetwork}
                            parentSecurity={parentSecurity}
                            isDefaultProfile={index === 0}
                            onRemove={() => {
                              if (index > 0) remove(field.name);
                            }}
                            onDuplicate={() => {
                              const current = form.getFieldValue([
                                'streamSettings', 'externalProxy', field.name,
                              ]);
                              const duplicate = duplicateSubscriptionProfile(current);
                              duplicate.remark = duplicate.remark
                                ? `${duplicate.remark} (${t('copy')})`
                                : `${t('pages.inbounds.form.subscriptionProfile')} ${index + 2}`;
                              add(duplicate, field.name + 1);
                            }}
                            onMoveUp={() => {
                              if (index > 1) move(field.name, field.name - 1);
                            }}
                            onMoveDown={() => {
                              if (index > 0) move(field.name, field.name + 1);
                            }}
                          />
                        ))}
                      </div>

                      <Button
                        className="ext-proxy-add"
                        block
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add(createSubscriptionProfileDraft())}
                      >
                        {t('pages.inbounds.form.addSubscriptionProfile')}
                      </Button>
                    </>
                  )}
                </Form.List>
              </Form.Item>
            )}
          </>
        );
      }}
    </Form.Item>
  );
}
