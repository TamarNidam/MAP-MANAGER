using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.Serializers;

namespace MapManager.Api.Infrastructure;

/// <summary>Makes every enum (and nullable enum) member use <see cref="EnumIdSerializer{TEnum}"/>.</summary>
public sealed class EnumIdConvention : ConventionBase, IMemberMapConvention
{
    public void Apply(BsonMemberMap memberMap)
    {
        var memberType = memberMap.MemberType;
        var enumType = Nullable.GetUnderlyingType(memberType) ?? memberType;
        if (!enumType.IsEnum)
        {
            return;
        }

        var serializer = (IBsonSerializer)Activator.CreateInstance(typeof(EnumIdSerializer<>).MakeGenericType(enumType))!;
        if (enumType != memberType)
        {
            serializer = (IBsonSerializer)Activator.CreateInstance(typeof(NullableSerializer<>).MakeGenericType(enumType), serializer)!;
        }

        memberMap.SetSerializer(serializer);
    }
}
