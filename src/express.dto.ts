export interface SwitTokenObject {
    access_token: string;
    refresh_token: string;
}
export interface SwitResponseBody {
    data: {
        user?: SwitUser;
        workspaces?: SwitWorkspace[];
        projects?: SwitProject[];
        offset?: string;
    };
}
interface SwitResourceBase {
    id: string;
    name: string;
}
interface SwitUser extends SwitResourceBase {
    user_email: string;
}
interface SwitWorkspace extends SwitResourceBase {}
interface SwitProject extends SwitResourceBase {}
