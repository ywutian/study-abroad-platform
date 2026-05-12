import {
  toPublicSchoolMediaAsset,
  toWikimediaThumbnailUrl,
} from './school-public-media.util';

describe('school public media utils', () => {
  it('builds a small Wikimedia thumbnail URL from an original upload URL', () => {
    expect(
      toWikimediaThumbnailUrl(
        'https://upload.wikimedia.org/wikipedia/commons/5/5a/California_Institute_of_Technology%2C_Pasadena%2C_California.jpg?utm_source=commons.wikimedia.org',
      ),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/California_Institute_of_Technology%2C_Pasadena%2C_California.jpg/500px-California_Institute_of_Technology%2C_Pasadena%2C_California.jpg',
    );
  });

  it('resizes an existing Wikimedia thumbnail URL without nesting width prefixes', () => {
    expect(
      toWikimediaThumbnailUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Campus_Club_Princeton_b.JPG/500px-Campus_Club_Princeton_b.JPG',
        250,
      ),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Campus_Club_Princeton_b.JPG/250px-Campus_Club_Princeton_b.JPG',
    );
  });

  it('keeps the original audited URL while serving the thumbnail URL', () => {
    const asset = toPublicSchoolMediaAsset({
      sourceType: 'WIKIMEDIA_COMMONS',
      originalUrl:
        'https://upload.wikimedia.org/wikipedia/commons/8/85/Campus_Club_Princeton_b.JPG?utm_source=commons.wikimedia.org',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Campus_Club_Princeton_b.JPG',
      license: 'CC BY-SA 3.0',
      attribution: 'Example',
      width: 2784,
      height: 1568,
    });

    expect(asset).toMatchObject({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Campus_Club_Princeton_b.JPG/500px-Campus_Club_Princeton_b.JPG',
      originalUrl:
        'https://upload.wikimedia.org/wikipedia/commons/8/85/Campus_Club_Princeton_b.JPG?utm_source=commons.wikimedia.org',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Campus_Club_Princeton_b.JPG',
      width: 2784,
      height: 1568,
    });
  });

  it('does not rewrite stored media URLs', () => {
    const asset = toPublicSchoolMediaAsset({
      sourceType: 'WIKIMEDIA_COMMONS',
      storageUrl: 'https://cdn.lumniedu.com/schools/school-1/campus.jpg',
      originalUrl:
        'https://upload.wikimedia.org/wikipedia/commons/8/85/Campus_Club_Princeton_b.JPG',
    });

    expect(asset?.url).toBe(
      'https://cdn.lumniedu.com/schools/school-1/campus.jpg',
    );
  });
});
