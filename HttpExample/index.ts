import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import bootstrap from '../src/main'; // ルート直下の関数→src は1つ上にある

const httpTrigger: AzureFunction = (
  context: Context,
  req: HttpRequest,
): void => {
  bootstrap(context, req);
};

export default httpTrigger;
