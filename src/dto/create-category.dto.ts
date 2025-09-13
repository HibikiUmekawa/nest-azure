import { IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsNotEmpty()
  name: string;
}
