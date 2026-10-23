import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="zh-Hant-HK" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>歡迎加入天喜賽馬！撳一下確認你嘅電郵地址，就可以開始使用。</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandRow}>
          <Text style={brand}>天喜賽馬</Text>
          <Text style={brandSub}>TIANXI · HONG KONG RACING</Text>
        </Section>
        <Img
          src={`${siteUrl}/email/mascot.png`}
          width="240"
          height="260"
          alt="天喜吉祥物：啡色小馬舉起大拇指歡迎你"
          style={mascot}
        />
        <Heading style={h1}>歡迎加入天喜賽馬！</Heading>
        <Text style={h1Sub}>Welcome to Tianxi Racing</Text>
        <Section align="center">
          <Section style={divider} />
        </Section>
        <Text style={text}>
          多謝你登記{siteName}帳戶。
          <br />
          請撳下面個掣，確認呢個電郵地址：
        </Text>
        <Text style={email}>{recipient}</Text>
        <Text style={textEn}>Please confirm your email address to activate your account.</Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          確認電郵&nbsp;&nbsp;Verify Email
        </Button>
        <Text style={fallbackLabel}>
          如果個掣撳唔到，可以複製以下連結貼去瀏覽器：
          <br />
          <span style={fallbackLabelEn}>If the button doesn't work, copy this link into your browser:</span>
        </Text>
        <Section style={linkBox}>
          <Link href={confirmationUrl} style={linkBoxLink}>
            {confirmationUrl}
          </Link>
        </Section>
        <Text style={footer}>
          如果你冇登記過天喜賽馬帳戶，可以直接忽略呢封電郵。
          <br />
          <span style={footerEn}>If you didn't create an account, you can safely ignore this email.</span>
        </Text>
      </Container>
      <Section style={footerBar}>
        <Link href={siteUrl} style={footerBrand}>
          tianxi.racing
        </Link>
        <Text style={footerNote}>數據模型預測 僅供參考 · 理性投注</Text>
      </Section>
    </Body>
  </Html>
)

export default SignupEmail

const serif = "'Noto Serif TC','Songti TC',PMingLiU,Georgia,serif"
const sans = "'Noto Sans TC','PingFang HK','Microsoft JhengHei',Arial,sans-serif"
const main = { backgroundColor: '#f7f3e8', fontFamily: sans }
const container = { margin: '0 auto', maxWidth: '600px', width: '100%' }
const brandRow = {
  backgroundColor: '#0f5a3c',
  borderBottom: '3px solid #c9a227',
  borderRadius: '14px 14px 0 0',
  padding: '22px 24px 18px',
  textAlign: 'center' as const,
}
const brand = {
  margin: '0',
  fontFamily: serif,
  fontSize: '26px',
  lineHeight: '32px',
  fontWeight: 'bold' as const,
  color: '#f2d49c',
  letterSpacing: '4px',
}
const brandSub = {
  margin: '2px 0 0',
  fontFamily: 'Georgia,serif',
  fontSize: '11px',
  lineHeight: '18px',
  color: '#d4a72c',
  letterSpacing: '3px',
}
const mascot = {
  display: 'block',
  margin: '28px auto 0',
  width: '240px',
  height: 'auto',
  maxWidth: '200px',
  border: '0',
}
const h1 = {
  margin: '12px 0 0',
  fontFamily: serif,
  fontSize: '30px',
  lineHeight: '40px',
  fontWeight: 'bold' as const,
  color: '#0f5a3c',
  textAlign: 'center' as const,
}
const h1Sub = {
  margin: '6px 0 0',
  fontFamily: 'Georgia,serif',
  fontSize: '14px',
  lineHeight: '20px',
  fontStyle: 'italic' as const,
  color: '#8a6d1c',
  textAlign: 'center' as const,
}
const divider = {
  width: '48px',
  height: '2px',
  backgroundColor: '#c9a227',
  marginTop: '18px',
}
const text = {
  margin: '20px 0 0',
  fontSize: '16px',
  lineHeight: '27px',
  color: '#2b2a26',
  textAlign: 'center' as const,
}
const email = {
  margin: '8px 0 0',
  fontSize: '16px',
  lineHeight: '24px',
  fontWeight: 'bold' as const,
  color: '#0f5a3c',
  wordBreak: 'break-all' as const,
  textAlign: 'center' as const,
}
const textEn = {
  margin: '10px 0 0',
  fontSize: '13px',
  lineHeight: '20px',
  color: '#7a7465',
  textAlign: 'center' as const,
}
const button = {
  backgroundColor: '#c9a227',
  color: '#0b3d2b',
  fontSize: '18px',
  lineHeight: '24px',
  fontWeight: 'bold' as const,
  letterSpacing: '1px',
  border: '1px solid #a8841a',
  borderRadius: '999px',
  padding: '16px 44px',
  textDecoration: 'none',
  margin: '20px auto 0',
}
const fallbackLabel = {
  margin: '22px 0 0',
  fontSize: '13px',
  lineHeight: '21px',
  color: '#6b6556',
  textAlign: 'center' as const,
}
const fallbackLabelEn = { fontSize: '12px', color: '#8a8473' }
const linkBox = {
  margin: '10px 0 0',
  backgroundColor: '#ffffff',
  border: '1px dashed #d9c78f',
  borderRadius: '8px',
  padding: '12px 14px',
}
const linkBoxLink = {
  fontFamily: 'Menlo,Consolas,monospace',
  fontSize: '12px',
  lineHeight: '18px',
  wordBreak: 'break-all' as const,
  color: '#0f5a3c',
  textDecoration: 'underline',
}
const footer = {
  margin: '24px 0 30px',
  fontSize: '13px',
  lineHeight: '21px',
  color: '#8a8473',
  textAlign: 'center' as const,
}
const footerEn = { fontSize: '12px' }
const footerBar = {
  backgroundColor: '#0b3d2b',
  borderTop: '3px solid #c9a227',
  borderRadius: '0 0 14px 14px',
  padding: '20px 24px 22px',
  textAlign: 'center' as const,
}
const footerBrand = {
  fontFamily: 'Georgia,serif',
  fontSize: '15px',
  lineHeight: '22px',
  fontWeight: 'bold' as const,
  color: '#f2d49c',
  textDecoration: 'none',
  letterSpacing: '1px',
}
const footerNote = { margin: '6px 0 0', fontSize: '12px', lineHeight: '19px', color: '#cfe0d6' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #c9a227 !important; color: #0b3d2b !important; }
  }
`
