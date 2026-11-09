export type AuthSession =
     |{status:'loading'}
     |{status:'anonymous'}
     |{status:'error'
         message:string}
     | {
    status:'authenticated';
    user:{
        id:string;
        isManager?: boolean;
        name?: string;
        email?: string;

    }
};
