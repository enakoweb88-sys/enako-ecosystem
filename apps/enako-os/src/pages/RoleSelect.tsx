import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Terminal, BriefcaseBusiness, Users, Globe, ShieldCheck } from 'lucide-react';
import './RoleSelect.css';

interface RoleCard {
  role: 'CEO' | 'CTO' | 'MANAGER' | 'EMPLOYEE' | 'OUTREACH_MANAGER';
  title: string;
  subtitle: string;
  description: string;
  color: string;
  badgeBg: string;
  borderHover: string;
}

const ROLES: RoleCard[] = [
  {
    role: 'CEO',
    title: 'CEO Workspace',
    subtitle: 'Chief Executive Officer',
    description: 'Full strategic control over enterprise command center, financial analytics, employee rosters, and system performance.',
    color: 'text-[#001F5B]',
    badgeBg: 'bg-[#001F5B]/10 text-[#001F5B] border-[#001F5B]/20',
    borderHover: 'hover:border-[#00C2C7] hover:shadow-[#001F5B]/10',
  },
  {
    role: 'CTO',
    title: 'CTO Workspace',
    subtitle: 'Chief Technology Officer',
    description: 'General oversight of the IT & engineering department, system architecture, telemetry, server health, credentials, and deployments.',
    color: 'text-[#00C2C7]',
    badgeBg: 'bg-[#00C2C7]/15 text-[#001F5B] border-[#00C2C7]/30',
    borderHover: 'hover:border-[#00C2C7] hover:shadow-[#00C2C7]/10',
  },
  {
    role: 'MANAGER',
    title: 'Manager Portal',
    subtitle: 'Department Operations',
    description: 'Oversee department workflows, approve requests, monitor employee activities, and manage team productivity.',
    color: 'text-[#00C2C7]',
    badgeBg: 'bg-[#00C2C7]/15 text-[#001F5B] border-[#00C2C7]/30',
    borderHover: 'hover:border-[#00C2C7] hover:shadow-[#00C2C7]/10',
  },
  {
    role: 'EMPLOYEE',
    title: 'Employee Portal',
    subtitle: 'Staff Workspace',
    description: 'Access personal workspace, submit expense reports, request staff meals, view announcements, and track assigned tasks.',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
    borderHover: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
  },
  {
    role: 'OUTREACH_MANAGER',
    title: 'Outreach Manager',
    subtitle: 'Community Impact',
    description: 'Manage outreach programs, review applications, publish blogs, handle newsletter subscriptions, and track web analytics.',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200/60',
    borderHover: 'hover:border-purple-300 hover:shadow-purple-500/10',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  const handleSelect = (role: 'CEO' | 'CTO' | 'MANAGER' | 'EMPLOYEE' | 'OUTREACH_MANAGER') => {
    sessionStorage.setItem('enako_selected_role', role);
    navigate(`/login?role=${role}`);
  };

  const icons = { CEO: Building2, CTO: Terminal, MANAGER: BriefcaseBusiness, EMPLOYEE: Users, OUTREACH_MANAGER: Globe };
  return <div className="os-roles">
    <header className="os-roles-header"><Link to="/" className="os-roles-brand" aria-label="ENAKO OS home">ENAKO<span>OS</span></Link><Link to="/" className="os-roles-back"><ArrowLeft size={14} />Back to home</Link></header>
    <main className="os-roles-main">
      <div className="os-roles-intro"><div><p className="os-roles-eyebrow"><span />YOUR ORGANIZATION, CONNECTED</p><h1>A workspace for<br />every part of your team.</h1></div><div className="os-roles-intro-note"><p>Choose where you work.<br />We’ll take you to your sign-in page.</p><span><ShieldCheck size={14} />Your permissions stay with your account.</span></div></div>
      <div className="os-roles-section-heading"><span>CHOOSE YOUR WORKSPACE</span><span>05 WORKSPACES</span></div>
      <div className="os-roles-grid">{ROLES.map((card, index) => { const Icon = icons[card.role]; return <button type="button" key={card.role} className={`os-roles-card${index <= 1 ? ' os-roles-card-executive' : ''}`} onClick={() => handleSelect(card.role)}><div className="os-roles-card-top"><div className="os-roles-icon"><Icon size={22} strokeWidth={1.6} /></div><span>0{index + 1}</span></div><div className="os-roles-card-body"><p>{card.subtitle}</p><h2>{card.title}</h2><div>{card.description}</div></div><div className="os-roles-card-action"><span>Continue to sign in</span><ArrowRight size={17} /></div></button>; })}</div>
      <div className="os-roles-help"><span className="os-roles-help-icon"><Users size={16} /></span><p><strong>Not sure which workspace is yours?</strong> Your workspace administrator can help you choose the right one.</p></div>
    </main>
    <footer className="os-roles-footer"><span>© {new Date().getFullYear()} ENAKO Cloud System</span><span>One organization. One workspace.</span></footer>
  </div>;
}
