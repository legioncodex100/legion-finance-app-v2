// Force dynamic rendering - Supabase client needs env vars at runtime
export const dynamic = 'force-dynamic'

import { LoginForm } from './login-form'

export default function LoginPage() {
    return <LoginForm />
}
